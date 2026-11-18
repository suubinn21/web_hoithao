<?php
/**
 * ITFTMS 2026 - API Quản Lý Giải Đấu & Đồng Bộ CSDL MySQL
 */
require_once __DIR__ . '/bootstrap.php';

$pdo = getDb();
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

function formatTournamentProfile($row) {
    $scheduleCfg = null;
    if (!empty($row['schedule_config_json'])) {
        $decoded = json_decode($row['schedule_config_json'], true);
        if (is_array($decoded)) {
            $scheduleCfg = $decoded;
        }
    }
    $sportType = 'FOOTBALL';
    if (isset($row['sport_type']) && $row['sport_type'] !== '') {
        $sportType = (string)$row['sport_type'];
    } elseif (is_array($scheduleCfg) && isset($scheduleCfg['sportType']) && $scheduleCfg['sportType'] !== '') {
        $sportType = (string)$scheduleCfg['sportType'];
    }
    $setConfig = (is_array($scheduleCfg) && isset($scheduleCfg['setConfig']) && is_array($scheduleCfg['setConfig']))
        ? $scheduleCfg['setConfig']
        : null;

    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'shortCode' => $row['short_code'],
        'year' => (int)$row['year'],
        'organizer' => $row['organizer'],
        'sportType' => $sportType,
        'setConfig' => $setConfig,
        'format' => $row['format'],
        'formatType' => isset($row['format_type']) && $row['format_type'] !== '' ? $row['format_type'] : 'SINGLE_LEAGUE',
        'maxTeams' => (int)$row['max_teams'],
        'numberOfGroups' => (int)$row['number_of_groups'],
        'teamsPerGroup' => (int)$row['teams_per_group'],
        'advancePerGroup' => (int)$row['advance_per_group'],
        'numberOfVenues' => (int)$row['number_of_venues'],
        'maxPlayersPerTeam' => (int)$row['max_players_per_team'],
        'matchDurationMinutes' => (int)$row['match_duration_minutes'],
        'breakDurationMinutes' => (int)$row['break_duration_minutes'],
        'registrationFee' => (int)$row['registration_fee'],
        'depositFee' => (int)$row['deposit_fee'],
        'startDate' => $row['start_date'],
        'endDate' => $row['end_date'],
        'status' => $row['status'],
        'description' => isset($row['description']) ? $row['description'] : '',
        'scheduleConfig' => $scheduleCfg,
    ];
}

function decodeJsonArray($raw) {
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function decodeJsonAssoc($raw) {
    if (!$raw) return new stdClass();
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || empty($decoded)) {
        return new stdClass();
    }
    return $decoded;
}

function buildTournamentPayload($row, $user) {
    $role = $user ? $user['role'] : 'STUDENT';
    $isAdmin = isOrganizerOrAdminRole($role);
    $isCaptain = ($role === 'TEAM_MANAGER');
    $myTeamId = ($user && !empty($user['team_id'])) ? (string)$user['team_id'] : '';

    $allComplaints = decodeJsonArray($row['complaints_json']);
    if ($isAdmin) {
        $visibleComplaints = $allComplaints;
    } elseif ($isCaptain && $myTeamId !== '') {
        $visibleComplaints = array_values(array_filter($allComplaints, function ($c) use ($myTeamId) {
            return isset($c['teamId']) && (string)$c['teamId'] === $myTeamId;
        }));
    } else {
        $visibleComplaints = [];
    }

    return [
        'tournament' => formatTournamentProfile($row),
        'teams' => decodeJsonArray($row['teams_json']),
        'matches' => decodeJsonArray($row['matches_json']),
        'venues' => decodeJsonArray($row['venues_json']),
        'referees' => decodeJsonArray($row['referees_json']),
        'complaints' => $visibleComplaints,
        'finances' => $isAdmin ? decodeJsonArray($row['finances_json']) : [],
        'awards' => decodeJsonArray($row['awards_json']),
        'auditLogs' => $isAdmin ? decodeJsonArray($row['audit_logs_json']) : [],
        'manualSuspensions' => decodeJsonAssoc($row['manual_suspensions_json']),
        'btcTieBreaks' => decodeJsonAssoc($row['btc_tiebreaks_json']),
        'paidFines' => decodeJsonAssoc(isset($row['paid_fines_json']) ? $row['paid_fines_json'] : '{}'),
        'status' => $row['status'],
        'updatedAt' => (int)$row['version'],
    ];
}

switch ($action) {
    case 'list':
        requireMethod('GET');
        $stmt = $pdo->query(
            'SELECT id, name, short_code, year, organizer, format, format_type, max_teams, number_of_groups,
                    teams_per_group, advance_per_group, number_of_venues, max_players_per_team,
                    match_duration_minutes, break_duration_minutes, registration_fee, deposit_fee,
                    start_date, end_date, status, description, schedule_config_json, teams_count, matches_count, version
             FROM tournaments
             ORDER BY year DESC, created_at DESC'
        );
        $list = [];
        $stats = [];
        while ($row = $stmt->fetch()) {
            $list[] = formatTournamentProfile($row);
            $stats[$row['id']] = [
                'teamsCount' => (int)$row['teams_count'],
                'matchesCount' => (int)$row['matches_count'],
                'version' => (int)$row['version'],
            ];
        }
        jsonResponse([
            'ok' => true,
            'tournaments' => $list,
            'stats' => empty($stats) ? new stdClass() : $stats,
        ]);
        break;

    case 'get':
        requireMethod('GET');
        $id = trim((string)(isset($_GET['id']) ? $_GET['id'] : ''));
        $sinceVersion = isset($_GET['sinceVersion']) ? (int)$_GET['sinceVersion'] : 0;

        if ($id === '') {
            jsonResponse(['ok' => false, 'error' => 'Thiếu mã giải đấu (id).'], 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM tournaments WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            jsonResponse(['ok' => false, 'code' => 'NOT_FOUND', 'error' => 'Giải đấu không tồn tại hoặc đã bị xóa.'], 404);
        }

        $currentVersion = (int)$row['version'];
        if ($sinceVersion > 0 && $sinceVersion === $currentVersion) {
            jsonResponse([
                'ok' => true,
                'unchanged' => true,
                'version' => $currentVersion,
            ]);
        }

        $user = currentSessionUser($pdo);
        jsonResponse([
            'ok' => true,
            'unchanged' => false,
            'version' => $currentVersion,
            'data' => buildTournamentPayload($row, $user),
        ]);
        break;

    case 'create':
        requireMethod('POST');
        $actor = requireOrganizerOrAdmin($pdo);
        $body = readJsonBody();

        $tour = isset($body['tournament']) && is_array($body['tournament']) ? $body['tournament'] : [];
        $id = trim((string)(isset($tour['id']) ? $tour['id'] : ''));
        $name = trim((string)(isset($tour['name']) ? $tour['name'] : ''));
        if ($id === '' || $name === '') {
            jsonResponse(['ok' => false, 'error' => 'Thiếu mã hoặc tên giải đấu!'], 400);
        }

        $teams = isset($body['teams']) && is_array($body['teams']) ? $body['teams'] : [];
        $matches = isset($body['matches']) && is_array($body['matches']) ? $body['matches'] : [];
        $venues = isset($body['venues']) && is_array($body['venues']) ? $body['venues'] : [];
        $referees = isset($body['referees']) && is_array($body['referees']) ? $body['referees'] : [];
        $complaints = isset($body['complaints']) && is_array($body['complaints']) ? $body['complaints'] : [];
        $finances = isset($body['finances']) && is_array($body['finances']) ? $body['finances'] : [];
        $awards = isset($body['awards']) && is_array($body['awards']) ? $body['awards'] : [];
        $auditLogs = isset($body['auditLogs']) && is_array($body['auditLogs']) ? array_slice($body['auditLogs'], 0, 150) : [];
        $manualSuspensions = isset($body['manualSuspensions']) && is_array($body['manualSuspensions']) ? $body['manualSuspensions'] : [];
        $btcTieBreaks = isset($body['btcTieBreaks']) && is_array($body['btcTieBreaks']) ? $body['btcTieBreaks'] : [];
        $paidFines = isset($body['paidFines']) && is_array($body['paidFines']) ? $body['paidFines'] : [];
        $scheduleConfig = isset($tour['scheduleConfig']) && is_array($tour['scheduleConfig']) ? $tour['scheduleConfig'] : [];
        $sportType = isset($tour['sportType']) && $tour['sportType'] !== '' ? (string)$tour['sportType'] : 'FOOTBALL';
        $scheduleConfig['sportType'] = $sportType;
        if (isset($tour['setConfig']) && is_array($tour['setConfig'])) {
            $scheduleConfig['setConfig'] = $tour['setConfig'];
        }
        $formatType = isset($tour['formatType']) && $tour['formatType'] !== '' ? (string)$tour['formatType'] : 'SINGLE_LEAGUE';
        $status = isset($body['status']) ? (string)$body['status'] : (isset($tour['status']) ? (string)$tour['status'] : 'REGISTRATION');
        $version = (int)round(microtime(true) * 1000);

        $stmt = $pdo->prepare(
            'INSERT INTO tournaments (
                id, name, short_code, year, organizer, format, format_type, max_teams, number_of_groups,
                teams_per_group, advance_per_group, number_of_venues, max_players_per_team,
                match_duration_minutes, break_duration_minutes, registration_fee, deposit_fee,
                start_date, end_date, status, description, schedule_config_json,
                teams_json, matches_json, venues_json, referees_json, complaints_json,
                finances_json, awards_json, audit_logs_json, manual_suspensions_json, btc_tiebreaks_json, paid_fines_json,
                teams_count, matches_count, version
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?
            )
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                short_code = VALUES(short_code),
                year = VALUES(year),
                organizer = VALUES(organizer),
                format = VALUES(format),
                format_type = VALUES(format_type),
                max_teams = VALUES(max_teams),
                number_of_groups = VALUES(number_of_groups),
                teams_per_group = VALUES(teams_per_group),
                advance_per_group = VALUES(advance_per_group),
                number_of_venues = VALUES(number_of_venues),
                max_players_per_team = VALUES(max_players_per_team),
                match_duration_minutes = VALUES(match_duration_minutes),
                break_duration_minutes = VALUES(break_duration_minutes),
                registration_fee = VALUES(registration_fee),
                deposit_fee = VALUES(deposit_fee),
                start_date = VALUES(start_date),
                end_date = VALUES(end_date),
                status = VALUES(status),
                description = VALUES(description),
                schedule_config_json = VALUES(schedule_config_json),
                teams_json = VALUES(teams_json),
                matches_json = VALUES(matches_json),
                venues_json = VALUES(venues_json),
                referees_json = VALUES(referees_json),
                complaints_json = VALUES(complaints_json),
                finances_json = VALUES(finances_json),
                awards_json = VALUES(awards_json),
                audit_logs_json = VALUES(audit_logs_json),
                manual_suspensions_json = VALUES(manual_suspensions_json),
                btc_tiebreaks_json = VALUES(btc_tiebreaks_json),
                paid_fines_json = VALUES(paid_fines_json),
                teams_count = VALUES(teams_count),
                matches_count = VALUES(matches_count),
                version = VALUES(version)'
        );

        $stmt->execute([
            $id,
            $name,
            isset($tour['shortCode']) ? (string)$tour['shortCode'] : 'CTUT-IT',
            isset($tour['year']) ? (int)$tour['year'] : 2026,
            isset($tour['organizer']) ? (string)$tour['organizer'] : '',
            isset($tour['format']) ? (string)$tour['format'] : 'Bóng đá sân 5 – Vòng tròn một lượt',
            $formatType,
            isset($tour['maxTeams']) ? (int)$tour['maxTeams'] : 12,
            isset($tour['numberOfGroups']) ? (int)$tour['numberOfGroups'] : 1,
            isset($tour['teamsPerGroup']) ? (int)$tour['teamsPerGroup'] : 12,
            isset($tour['advancePerGroup']) ? (int)$tour['advancePerGroup'] : 3,
            isset($tour['numberOfVenues']) ? (int)$tour['numberOfVenues'] : 3,
            isset($tour['maxPlayersPerTeam']) ? (int)$tour['maxPlayersPerTeam'] : 12,
            isset($tour['matchDurationMinutes']) ? (int)$tour['matchDurationMinutes'] : 60,
            isset($tour['breakDurationMinutes']) ? (int)$tour['breakDurationMinutes'] : 5,
            isset($tour['registrationFee']) ? (int)$tour['registrationFee'] : 100000,
            isset($tour['depositFee']) ? (int)$tour['depositFee'] : 0,
            isset($tour['startDate']) ? (string)$tour['startDate'] : '2026-10-18',
            isset($tour['endDate']) ? (string)$tour['endDate'] : '2026-11-29',
            $status,
            isset($tour['description']) ? (string)$tour['description'] : '',
            json_encode(empty($scheduleConfig) ? new stdClass() : $scheduleConfig, JSON_UNESCAPED_UNICODE),
            json_encode($teams, JSON_UNESCAPED_UNICODE),
            json_encode($matches, JSON_UNESCAPED_UNICODE),
            json_encode($venues, JSON_UNESCAPED_UNICODE),
            json_encode($referees, JSON_UNESCAPED_UNICODE),
            json_encode($complaints, JSON_UNESCAPED_UNICODE),
            json_encode($finances, JSON_UNESCAPED_UNICODE),
            json_encode($awards, JSON_UNESCAPED_UNICODE),
            json_encode($auditLogs, JSON_UNESCAPED_UNICODE),
            json_encode(empty($manualSuspensions) ? new stdClass() : $manualSuspensions, JSON_UNESCAPED_UNICODE),
            json_encode(empty($btcTieBreaks) ? new stdClass() : $btcTieBreaks, JSON_UNESCAPED_UNICODE),
            json_encode(empty($paidFines) ? new stdClass() : $paidFines, JSON_UNESCAPED_UNICODE),
            count($teams),
            count($matches),
            $version,
        ]);

        jsonResponse(['ok' => true, 'id' => $id, 'version' => $version]);
        break;

    case 'save':
        requireMethod('POST');
        $actor = requireAuth($pdo);
        $role = $actor['role'];
        if ($role === 'STUDENT') {
            jsonResponse(['ok' => false, 'error' => 'Tài khoản Sinh viên chỉ có quyền xem, không thể chỉnh sửa dữ liệu giải đấu!'], 403);
        }

        $body = readJsonBody();
        $id = trim((string)(isset($body['id']) ? $body['id'] : ''));
        if ($id === '') {
            jsonResponse(['ok' => false, 'error' => 'Thiếu mã giải đấu (id).'], 400);
        }

        $pdo->beginTransaction();
        try {
            $sel = $pdo->prepare('SELECT * FROM tournaments WHERE id = ? FOR UPDATE');
            $sel->execute([$id]);
            $row = $sel->fetch();
            if (!$row) {
                $pdo->rollBack();
                jsonResponse(['ok' => false, 'error' => 'Giải đấu không tồn tại trên CSDL!'], 404);
            }

            $teams = decodeJsonArray($row['teams_json']);
            $matches = decodeJsonArray($row['matches_json']);
            $venues = decodeJsonArray($row['venues_json']);
            $referees = decodeJsonArray($row['referees_json']);
            $complaints = decodeJsonArray($row['complaints_json']);
            $finances = decodeJsonArray($row['finances_json']);
            $awards = decodeJsonArray($row['awards_json']);
            $auditLogs = decodeJsonArray($row['audit_logs_json']);
            $manualSuspensions = json_decode($row['manual_suspensions_json'], true);
            if (!is_array($manualSuspensions)) $manualSuspensions = [];
            $btcTieBreaks = json_decode($row['btc_tiebreaks_json'], true);
            if (!is_array($btcTieBreaks)) $btcTieBreaks = [];
            $paidFines = json_decode(isset($row['paid_fines_json']) ? $row['paid_fines_json'] : '{}', true);
            if (!is_array($paidFines)) $paidFines = [];

            $tourMeta = formatTournamentProfile($row);
            $status = $row['status'];

            if (isOrganizerOrAdminRole($role)) {
                if (isset($body['tournament']) && is_array($body['tournament'])) {
                    $t = $body['tournament'];
                    $tourMeta = [
                        'id' => $id,
                        'name' => isset($t['name']) ? trim((string)$t['name']) : $tourMeta['name'],
                        'shortCode' => isset($t['shortCode']) ? trim((string)$t['shortCode']) : $tourMeta['shortCode'],
                        'year' => isset($t['year']) ? (int)$t['year'] : $tourMeta['year'],
                        'organizer' => isset($t['organizer']) ? (string)$t['organizer'] : $tourMeta['organizer'],
                        'sportType' => isset($t['sportType']) && $t['sportType'] !== '' ? (string)$t['sportType'] : $tourMeta['sportType'],
                        'setConfig' => isset($t['setConfig']) && is_array($t['setConfig']) ? $t['setConfig'] : $tourMeta['setConfig'],
                        'format' => isset($t['format']) ? (string)$t['format'] : $tourMeta['format'],
                        'formatType' => isset($t['formatType']) ? (string)$t['formatType'] : $tourMeta['formatType'],
                        'maxTeams' => isset($t['maxTeams']) ? (int)$t['maxTeams'] : $tourMeta['maxTeams'],
                        'numberOfGroups' => isset($t['numberOfGroups']) ? (int)$t['numberOfGroups'] : $tourMeta['numberOfGroups'],
                        'teamsPerGroup' => isset($t['teamsPerGroup']) ? (int)$t['teamsPerGroup'] : $tourMeta['teamsPerGroup'],
                        'advancePerGroup' => isset($t['advancePerGroup']) ? (int)$t['advancePerGroup'] : $tourMeta['advancePerGroup'],
                        'numberOfVenues' => isset($t['numberOfVenues']) ? (int)$t['numberOfVenues'] : $tourMeta['numberOfVenues'],
                        'maxPlayersPerTeam' => isset($t['maxPlayersPerTeam']) ? (int)$t['maxPlayersPerTeam'] : $tourMeta['maxPlayersPerTeam'],
                        'matchDurationMinutes' => isset($t['matchDurationMinutes']) ? (int)$t['matchDurationMinutes'] : $tourMeta['matchDurationMinutes'],
                        'breakDurationMinutes' => isset($t['breakDurationMinutes']) ? (int)$t['breakDurationMinutes'] : $tourMeta['breakDurationMinutes'],
                        'registrationFee' => isset($t['registrationFee']) ? (int)$t['registrationFee'] : $tourMeta['registrationFee'],
                        'depositFee' => isset($t['depositFee']) ? (int)$t['depositFee'] : $tourMeta['depositFee'],
                        'startDate' => isset($t['startDate']) ? (string)$t['startDate'] : $tourMeta['startDate'],
                        'endDate' => isset($t['endDate']) ? (string)$t['endDate'] : $tourMeta['endDate'],
                        'status' => isset($t['status']) ? (string)$t['status'] : $tourMeta['status'],
                        'description' => isset($t['description']) ? (string)$t['description'] : $tourMeta['description'],
                        'scheduleConfig' => isset($t['scheduleConfig']) && is_array($t['scheduleConfig']) ? $t['scheduleConfig'] : $tourMeta['scheduleConfig'],
                    ];
                    $status = $tourMeta['status'];
                }
                if (isset($body['status'])) {
                    $status = (string)$body['status'];
                    $tourMeta['status'] = $status;
                }
                if (isset($body['teams']) && is_array($body['teams'])) $teams = $body['teams'];
                if (isset($body['matches']) && is_array($body['matches'])) $matches = $body['matches'];
                if (isset($body['venues']) && is_array($body['venues'])) $venues = $body['venues'];
                if (isset($body['referees']) && is_array($body['referees'])) $referees = $body['referees'];
                if (isset($body['complaints']) && is_array($body['complaints'])) $complaints = $body['complaints'];
                if (isset($body['finances']) && is_array($body['finances'])) $finances = $body['finances'];
                if (isset($body['awards']) && is_array($body['awards'])) $awards = $body['awards'];
                if (isset($body['auditLogs']) && is_array($body['auditLogs'])) $auditLogs = array_slice($body['auditLogs'], 0, 150);
                if (isset($body['manualSuspensions']) && is_array($body['manualSuspensions'])) $manualSuspensions = $body['manualSuspensions'];
                if (isset($body['btcTieBreaks']) && is_array($body['btcTieBreaks'])) $btcTieBreaks = $body['btcTieBreaks'];
                if (isset($body['paidFines']) && is_array($body['paidFines'])) $paidFines = $body['paidFines'];
            } elseif ($role === 'REFEREE') {
                // Trọng tài chỉ được cập nhật trận đấu, chỉ số bàn thắng/thẻ của cầu thủ hiện có và auditLogs
                if (isset($body['matches']) && is_array($body['matches'])) {
                    $matches = $body['matches'];
                }
                if (isset($body['teams']) && is_array($body['teams'])) {
                    $incomingById = [];
                    foreach ($body['teams'] as $it) {
                        if (!empty($it['id'])) $incomingById[$it['id']] = $it;
                    }
                    foreach ($teams as &$existingTeam) {
                        $tid = isset($existingTeam['id']) ? $existingTeam['id'] : '';
                        if ($tid !== '' && isset($incomingById[$tid]['players']) && is_array($incomingById[$tid]['players']) && isset($existingTeam['players']) && is_array($existingTeam['players'])) {
                            $incomingPlayers = [];
                            foreach ($incomingById[$tid]['players'] as $ip) {
                                if (!empty($ip['id'])) $incomingPlayers[$ip['id']] = $ip;
                            }
                            foreach ($existingTeam['players'] as &$ep) {
                                $pid = isset($ep['id']) ? $ep['id'] : '';
                                if ($pid !== '' && isset($incomingPlayers[$pid])) {
                                    $ip = $incomingPlayers[$pid];
                                    if (isset($ip['goals'])) $ep['goals'] = (int)$ip['goals'];
                                    if (isset($ip['assists'])) $ep['assists'] = (int)$ip['assists'];
                                    if (isset($ip['yellowCards'])) $ep['yellowCards'] = (int)$ip['yellowCards'];
                                    if (isset($ip['redCards'])) $ep['redCards'] = (int)$ip['redCards'];
                                    if (isset($ip['isSuspended'])) $ep['isSuspended'] = (bool)$ip['isSuspended'];
                                    if (array_key_exists('suspensionReason', $ip)) $ep['suspensionReason'] = $ip['suspensionReason'];
                                }
                            }
                            unset($ep);
                        }
                    }
                    unset($existingTeam);
                }
                if (isset($body['auditLogs']) && is_array($body['auditLogs'])) {
                    // Merge new audit logs at front without losing existing ones
                    $existingIds = [];
                    foreach ($auditLogs as $l) {
                        if (!empty($l['id'])) $existingIds[$l['id']] = true;
                    }
                    $newEntries = [];
                    foreach ($body['auditLogs'] as $l) {
                        if (!empty($l['id']) && $l['id'] !== 'AUD-00' && !isset($existingIds[$l['id']])) {
                            $newEntries[] = $l;
                        }
                    }
                    $auditLogs = array_slice(array_merge($newEntries, $auditLogs), 0, 150);
                }
            } elseif ($role === 'TEAM_MANAGER') {
                $myTeamId = !empty($actor['team_id']) ? (string)$actor['team_id'] : '';
                if ($myTeamId === '') {
                    $pdo->rollBack();
                    jsonResponse(['ok' => false, 'error' => 'Tài khoản Đội trưởng chưa được gắn với đội bóng nào!'], 403);
                }

                // Đội trưởng chỉ được sửa danh sách cầu thủ của đội mình (giữ nguyên chỉ số bàn thắng/thẻ phạt từ CSDL)
                if (isset($body['teams']) && is_array($body['teams'])) {
                    $incomingMyTeam = null;
                    foreach ($body['teams'] as $it) {
                        if (!empty($it['id']) && (string)$it['id'] === $myTeamId) {
                            $incomingMyTeam = $it;
                            break;
                        }
                    }
                    if ($incomingMyTeam !== null && isset($incomingMyTeam['players']) && is_array($incomingMyTeam['players'])) {
                        $maxPlayers = max(2, (int)$tourMeta['maxPlayersPerTeam']);
                        if (count($incomingMyTeam['players']) > $maxPlayers) {
                            $pdo->rollBack();
                            jsonResponse(['ok' => false, 'error' => "Mỗi đội tối đa {$maxPlayers} cầu thủ!"], 400);
                        }
                        foreach ($teams as &$existingTeam) {
                            if (isset($existingTeam['id']) && (string)$existingTeam['id'] === $myTeamId) {
                                $existingPlayerMap = [];
                                if (isset($existingTeam['players']) && is_array($existingTeam['players'])) {
                                    foreach ($existingTeam['players'] as $ep) {
                                        if (!empty($ep['id'])) $existingPlayerMap[$ep['id']] = $ep;
                                    }
                                }
                                $sanitizedPlayers = [];
                                foreach ($incomingMyTeam['players'] as $ip) {
                                    $pid = isset($ip['id']) ? (string)$ip['id'] : '';
                                    $prev = ($pid !== '' && isset($existingPlayerMap[$pid])) ? $existingPlayerMap[$pid] : null;
                                    $ip['teamId'] = $myTeamId;
                                    $ip['yellowCards'] = $prev ? (int)(isset($prev['yellowCards']) ? $prev['yellowCards'] : 0) : 0;
                                    $ip['redCards'] = $prev ? (int)(isset($prev['redCards']) ? $prev['redCards'] : 0) : 0;
                                    $ip['isSuspended'] = $prev ? (bool)(isset($prev['isSuspended']) ? $prev['isSuspended'] : false) : false;
                                    if ($prev && isset($prev['suspensionReason'])) {
                                        $ip['suspensionReason'] = $prev['suspensionReason'];
                                    } else {
                                        unset($ip['suspensionReason']);
                                    }
                                    $ip['goals'] = $prev ? (int)(isset($prev['goals']) ? $prev['goals'] : 0) : 0;
                                    $ip['assists'] = $prev ? (int)(isset($prev['assists']) ? $prev['assists'] : 0) : 0;
                                    $sanitizedPlayers[] = $ip;
                                }
                                $existingTeam['players'] = $sanitizedPlayers;
                                break;
                            }
                        }
                        unset($existingTeam);
                    }
                }

                // Đội trưởng chỉ được gửi thêm đơn khiếu nại cho đội mình (không ghi đè đơn của đội khác)
                if (isset($body['complaints']) && is_array($body['complaints'])) {
                    $existingCmpIds = [];
                    foreach ($complaints as $ec) {
                        if (!empty($ec['id'])) $existingCmpIds[$ec['id']] = true;
                    }
                    $toAdd = [];
                    foreach ($body['complaints'] as $ic) {
                        if (
                            !empty($ic['id']) &&
                            !isset($existingCmpIds[$ic['id']]) &&
                            isset($ic['teamId']) &&
                            (string)$ic['teamId'] === $myTeamId
                        ) {
                            $ic['status'] = 'PENDING';
                            unset($ic['reviewerResponse'], $ic['resolvedAt']);
                            $toAdd[] = $ic;
                        }
                    }
                    if (!empty($toAdd)) {
                        $complaints = array_merge($toAdd, $complaints);
                    }
                }

                if (isset($body['auditLogs']) && is_array($body['auditLogs'])) {
                    $existingIds = [];
                    foreach ($auditLogs as $l) {
                        if (!empty($l['id'])) $existingIds[$l['id']] = true;
                    }
                    $newEntries = [];
                    foreach ($body['auditLogs'] as $l) {
                        if (!empty($l['id']) && $l['id'] !== 'AUD-00' && !isset($existingIds[$l['id']])) {
                            $newEntries[] = $l;
                        }
                    }
                    $auditLogs = array_slice(array_merge($newEntries, $auditLogs), 0, 150);
                }
            }

            $scheduleConfigForDb = is_array($tourMeta['scheduleConfig']) ? $tourMeta['scheduleConfig'] : [];
            $scheduleConfigForDb['sportType'] = isset($tourMeta['sportType']) && $tourMeta['sportType'] !== '' ? (string)$tourMeta['sportType'] : 'FOOTBALL';
            if (isset($tourMeta['setConfig']) && is_array($tourMeta['setConfig'])) {
                $scheduleConfigForDb['setConfig'] = $tourMeta['setConfig'];
            }

            $version = (int)round(microtime(true) * 1000);
            $upd = $pdo->prepare(
                'UPDATE tournaments SET
                    name = ?, short_code = ?, year = ?, organizer = ?, format = ?, format_type = ?,
                    max_teams = ?, number_of_groups = ?, teams_per_group = ?, advance_per_group = ?,
                    number_of_venues = ?, max_players_per_team = ?, match_duration_minutes = ?,
                    break_duration_minutes = ?, registration_fee = ?, deposit_fee = ?,
                    start_date = ?, end_date = ?, status = ?, description = ?, schedule_config_json = ?,
                    teams_json = ?, matches_json = ?, venues_json = ?, referees_json = ?,
                    complaints_json = ?, finances_json = ?, awards_json = ?, audit_logs_json = ?,
                    manual_suspensions_json = ?, btc_tiebreaks_json = ?, paid_fines_json = ?,
                    teams_count = ?, matches_count = ?, version = ?
                 WHERE id = ?'
            );
            $upd->execute([
                $tourMeta['name'],
                $tourMeta['shortCode'],
                $tourMeta['year'],
                $tourMeta['organizer'],
                $tourMeta['format'],
                $tourMeta['formatType'],
                $tourMeta['maxTeams'],
                $tourMeta['numberOfGroups'],
                $tourMeta['teamsPerGroup'],
                $tourMeta['advancePerGroup'],
                $tourMeta['numberOfVenues'],
                $tourMeta['maxPlayersPerTeam'],
                $tourMeta['matchDurationMinutes'],
                $tourMeta['breakDurationMinutes'],
                $tourMeta['registrationFee'],
                $tourMeta['depositFee'],
                $tourMeta['startDate'],
                $tourMeta['endDate'],
                $status,
                $tourMeta['description'],
                json_encode(empty($scheduleConfigForDb) ? new stdClass() : $scheduleConfigForDb, JSON_UNESCAPED_UNICODE),
                json_encode($teams, JSON_UNESCAPED_UNICODE),
                json_encode($matches, JSON_UNESCAPED_UNICODE),
                json_encode($venues, JSON_UNESCAPED_UNICODE),
                json_encode($referees, JSON_UNESCAPED_UNICODE),
                json_encode($complaints, JSON_UNESCAPED_UNICODE),
                json_encode($finances, JSON_UNESCAPED_UNICODE),
                json_encode($awards, JSON_UNESCAPED_UNICODE),
                json_encode($auditLogs, JSON_UNESCAPED_UNICODE),
                json_encode(empty($manualSuspensions) ? new stdClass() : $manualSuspensions, JSON_UNESCAPED_UNICODE),
                json_encode(empty($btcTieBreaks) ? new stdClass() : $btcTieBreaks, JSON_UNESCAPED_UNICODE),
                json_encode(empty($paidFines) ? new stdClass() : $paidFines, JSON_UNESCAPED_UNICODE),
                count($teams),
                count($matches),
                $version,
                $id,
            ]);

            $pdo->commit();
            jsonResponse(['ok' => true, 'version' => $version]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            jsonResponse(['ok' => false, 'error' => 'Lỗi lưu dữ liệu vào CSDL MySQL.'], 500);
        }
        break;

    case 'delete':
        requireMethod('POST');
        $actor = requireOrganizerOrAdmin($pdo);
        $body = readJsonBody();
        $id = trim((string)(isset($body['id']) ? $body['id'] : ''));
        if ($id === '') {
            jsonResponse(['ok' => false, 'error' => 'Thiếu mã giải đấu cần xóa!'], 400);
        }
        $del = $pdo->prepare('DELETE FROM tournaments WHERE id = ?');
        $del->execute([$id]);

        writeAuthAuditLog(
            $pdo,
            $actor['full_name'],
            $actor['role'],
            'XÓA GIẢI ĐẤU',
            $id,
            'Đã xóa giải đấu ' . $id . ' khỏi CSDL MySQL.'
        );

        jsonResponse(['ok' => true]);
        break;

    default:
        jsonResponse(['ok' => false, 'error' => 'Action không hợp lệ.'], 400);
}
