<?php
session_start();
if (isset($_SESSION['atendente_id'])) {
    header('Location: views/atendimento.php');
} else {
    header('Location: views/login.php');
}
