<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['atendente_id']) || $_SESSION['atendente_id'] != 1) {
    http_response_code(403);
    echo json_encode(['erro' => 'Acesso negado']);
    exit;
}

require_once '../classes/Database.php';
$pdo = Database::getConn();
$method = $_SERVER['REQUEST_METHOD'];

// Listar atendentes (GET)
if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT id, nome, email, telefone, status, ativo, is_admin as isAdmin FROM atendentes ORDER BY nome");
    $stmt->execute();
    echo json_encode($stmt->fetchAll());
    exit;
}

// Criar atendente (POST)
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $nome = $data['nome'] ?? '';
    $email = $data['email'] ?? '';
    $telefone = $data['telefone'] ?? '';
    $status = $data['status'] ?? 'offline';  // recebe do frontend
    $ativo = $data['ativo'] ?? 1;            // recebe do frontend
    $isAdmin = $data['isAdmin'] ?? false;     // recebe do frontend
    $senha = password_hash('123456', PASSWORD_DEFAULT); // senha padrão

    $stmt = $pdo->prepare("INSERT INTO atendentes (nome, email, telefone, senha, status, ativo, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$nome, $email, $telefone, $senha, $status, $ativo, $isAdmin]);
    echo json_encode(['status' => 'ok', 'id' => $pdo->lastInsertId()]);
    exit;
}

// Editar atendente (PUT)
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    $nome = $data['nome'];
    $email = $data['email'];
    $telefone = $data['telefone'];
    $status = $data['status'];        // novo campo
    $ativo = $data['ativo'] ? 1 : 0;  // converte para int
    $isAdmin = $data['isAdmin'] ?? false;     // recebe do frontend

    $stmt = $pdo->prepare("UPDATE atendentes SET nome = ?, email = ?, telefone = ?, status = ?, ativo = ?, is_admin = ? WHERE id = ?");
    $stmt->execute([$nome, $email, $telefone, $status, $ativo, $isAdmin, $id]);
    echo json_encode(['status' => 'ok']);
    exit;
}

// Excluir atendente (DELETE) – opcional, pode ser substituído por desativar
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    $stmt = $pdo->prepare("DELETE FROM atendentes WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['status' => 'ok']);
    exit;
}
