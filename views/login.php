<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Login - Atendimento WhatsApp</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/styles.css" rel="stylesheet">
    <style>
        /* Garantir que o login use o container responsivo */
        body {
            overflow: auto;
            height: auto;
        }
    </style>
</head>

<body>
    <div class="login-container">
        <div class="login-card">
            <h2>Atendimento WhatsApp</h2>
            <form action="../api/auth.php" method="POST">
                <input type="email" name="email" class="form-control" placeholder="E-mail" required autofocus>
                <input type="password" name="senha" class="form-control" placeholder="Senha" required>
                <button type="submit" class="btn btn-primary">Entrar</button>
            </form>
        </div>
    </div>
    <script src="../assets/js/toast.js"></script>
    <?php if (isset($_GET['erro'])): ?>
        <script>
            toast('Usuário ou senha inválidos', 'error');
        </script>
    <?php endif; ?>
</body>

</html>