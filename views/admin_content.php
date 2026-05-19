<div class="container-fluid p-4">
    <h2 class="mb-4">📊 Dashboard</h2>

    <!-- Cards principais -->
    <div class="row g-4 mb-4">
        <div class="col-md-6 col-lg-4">
            <div class="card text-white bg-primary h-100 shadow-sm">
                <div class="card-header bg-primary bg-opacity-75">Atendimentos no mês</div>
                <div class="card-body d-flex align-items-center justify-content-between">
                    <h3 class="card-title mb-0" id="totalMesValue">0</h3>
                    <i class="bi bi-chat-dots-fill fs-1 opacity-50"></i>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-8">
            <div class="card text-white bg-success h-100 shadow-sm">
                <div class="card-header bg-success bg-opacity-75">Atendente destaque do mês</div>
                <div class="card-body d-flex align-items-center justify-content-between">
                    <div>
                        <h4 class="card-title mb-1" id="topAtendenteNome">Nenhum</h4>
                        <p class="mb-0" id="topAtendenteTotal">0 atendimentos</p>
                    </div>
                    <i class="bi bi-trophy-fill fs-1 opacity-50"></i>
                </div>
            </div>
        </div>
    </div>

    <!-- Gráfico e tabela de atendentes -->
    <div class="row g-4">
        <div class="col-lg-6">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-white">Atendimentos por setor (últimos 30 dias)</div>
                <div class="card-body">
                    <canvas id="setoresChart" width="400" height="250" style="max-width:100%; height:auto;"></canvas>
                </div>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-white">Lista de Atendentes</div>
                <div class="card-body p-0">
                    <div class="table-responsive" style="max-height: 350px; overflow-y: auto;">
                        <table class="table table-hover table-striped mb-0" id="atendentesTable">
                            <thead class="table-light">
                                <tr>
                                    <th>Nome</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Ativo</th>
                                </tr>
                            </thead>
                            <tbody id="atendentesTableBody">
                                <tr>
                                    <td colspan="4" class="text-center">Carregando...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">