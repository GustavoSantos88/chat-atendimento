<?php
session_start();
session_destroy();

// Limpa o localStorage do navegador via script antes de redirecionar
echo '<!DOCTYPE html>
<html>
<head>
    <script>
        localStorage.removeItem("dashboardActiveTab");
        window.location.href = "../views/login.php";
    </script>
</head>
<body></body>
</html>';
exit;
