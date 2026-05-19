<?php
session_start();
require_once '../classes/Database.php';
$pdo = Database::getConn();

$email = $_POST['email'];
$senha = $_POST['senha'];

$stmt = $pdo->prepare("SELECT * FROM atendentes WHERE email = ? AND ativo = 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user && password_verify($senha, $user['senha'])) {
    $_SESSION['atendente_id'] = $user['id'];
    $_SESSION['atendente_nome'] = $user['nome'];
    $_SESSION['is_admin'] = ($user['id'] == 1) ? true : false;

    // Redireciona conforme perfil
    if ($user['id'] == 1) { // admin
        header('Location: ../views/dashboard.php');
    } else {
        header('Location: ../views/atendimento.php');
    }
} else {
    header('Location: ../views/login.php?erro=1');
}
