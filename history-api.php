<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// 数据库配置
$db_file = 'sms_history.db';

// 初始化 SQLite 数据库
function init_db() {
    global $db_file;
    $db = new SQLite3($db_file);
    
    // 创建历史记录表
    $db->exec('CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        phone TEXT,
        code TEXT,
        timestamp INTEGER
    )');
    
    return $db;
}

$db = init_db();

// 处理请求
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'save':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare('INSERT INTO history (username, phone, code, timestamp) VALUES (:username, :phone, :code, :timestamp)');
        $stmt->bindValue(':username', $data['username']);
        $stmt->bindValue(':phone', $data['phone']);
        $stmt->bindValue(':code', $data['code']);
        $stmt->bindValue(':timestamp', time());
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save record']);
        }
        break;
        
    case 'get':
        $username = $_GET['username'] ?? '';
        $stmt = $db->prepare('SELECT * FROM history WHERE username = :username ORDER BY timestamp DESC');
        $stmt->bindValue(':username', $username);
        $result = $stmt->execute();
        
        $records = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $records[] = $row;
        }
        
        echo json_encode($records);
        break;
        
    case 'count':
        $username = $_GET['username'] ?? '';
        $stmt = $db->prepare('SELECT COUNT(*) as count FROM history WHERE username = :username');
        $stmt->bindValue(':username', $username);
        $result = $stmt->execute();
        $count = $result->fetchArray(SQLITE3_ASSOC)['count'];
        
        echo json_encode(['count' => $count]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

$db->close(); 