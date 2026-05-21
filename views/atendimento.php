<?php
session_start();
if (!isset($_SESSION['atendente_id'])) header('Location: login.php');
require_once '../config/app.php';
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Atendimento WhatsApp</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/styles.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
</head>

<body>
    <?php include 'chat_content.php'; ?>
</body>

<script>
    window.baseUrl = '<?= BASE_URL ?>';
    window.socketUrl = '<?= SOCKET_URL ?>';
    window.secretKey = '<?= API_KEY ?>';
    window.atendenteId = <?= json_encode($_SESSION['atendente_id']) ?>;
    window.atendenteNome = <?= json_encode($_SESSION['atendente_nome']) ?>;
</script>

<script src="../assets/js/toast.js"></script>
<script src="../assets/js/utils.js"></script>
<script src="../assets/js/dashboard.js"></script>

</html>