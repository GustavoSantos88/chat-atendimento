<div class="container-fluid p-4">
    <h2 class="mb-4">⚙️ Gerenciamento</h2>

    <ul class="nav nav-tabs" id="manageTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="atendentes-tab" data-bs-toggle="tab" data-bs-target="#atendentes" type="button" role="tab">Atendentes</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="setores-tab" data-bs-toggle="tab" data-bs-target="#setores" type="button" role="tab">Setores</button>
        </li>
    </ul>
    <div class="tab-content mt-3" id="manageTabsContent">
        <!-- Aba Atendentes -->
        <div class="tab-pane fade show active" id="atendentes" role="tabpanel">
            <div class="mb-3">
                <button class="btn btn-success btn-sm" id="novoAtendenteBtn">+ Novo Atendente</button>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-hover" id="atendentesTable">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Telefone</th>
                            <th>Status</th>
                            <th>Admin</th>
                            <th>Ativo</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="atendentesTableBody">
                        <tr>
                            <td colspan="7" class="text-center">Carregando...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Aba Setores -->
        <div class="tab-pane fade" id="setores" role="tabpanel">
            <div class="mb-3">
                <button class="btn btn-success btn-sm" id="novoSetorBtn">+ Novo Setor</button>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-hover" id="setoresTable">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="setoresTableBody">
                        <tr>
                            <td colspan="4" class="text-center">Carregando...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
<script src="../assets/js/admin_manage.js"></script>