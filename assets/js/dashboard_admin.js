// dashboard_admin.js
let currentChart = null;
let refreshInterval = null;

function atualizarDashboardAdmin() {
    // Verifica se os elementos do dashboard existem (apenas na aba admin)
    const totalMesEl = document.getElementById('totalMesValue');
    if (!totalMesEl) {
        // Não estamos na aba admin, então não faz nada (sem loop infinito)
        return;
    }

    fetch(window.baseUrl + 'api/dashboard_data.php')
        .then(response => {
            if (!response.ok) throw new Error('Erro na resposta da API');
            return response.json();
        })
        .then(data => {
            document.getElementById('totalMesValue').innerText = data.totalMes;
            document.getElementById('topAtendenteNome').innerText = data.topAtendente.nome;
            document.getElementById('topAtendenteTotal').innerText = data.topAtendente.total + ' atendimentos';

            const tbody = document.getElementById('atendentesTableBody');
            if (tbody) {
                if (!data.atendentes || data.atendentes.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum atendente cadastrado</td></tr>';
                } else {
                    let html = '';
                    data.atendentes.forEach(att => {
                        let statusBadge = '';
                        if (att.status === 'online') statusBadge = '<span class="badge bg-success">online</span>';
                        else if (att.status === 'offline') statusBadge = '<span class="badge bg-secondary">offline</span>';
                        else statusBadge = '<span class="badge bg-warning">pausa</span>';
                        let ativoIcon = att.ativo ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>';
                        html += `<tr>
                                    <td>${escapeHtml(att.nome)}</td>
                                    <td>${escapeHtml(att.email)}</td>
                                    <td>${statusBadge}</td>
                                    <td>${ativoIcon}</td>
                                </tr>`;
                    });
                    tbody.innerHTML = html;
                }
            }

            atualizarGrafico(data.setores || []);
        })
        .catch(err => {
            console.error('Erro ao carregar dados do dashboard:', err);
            toast('Erro ao carregar dados estatísticos.', 'error');
        });
}

function gerarCores(numCores) {
    // Paleta de cores distintas
    const paleta = [
        '#4361ee', '#e63946', '#f4a261', '#2a9d8f', '#e9c46a',
        '#9b5de5', '#ff6d00', '#00b4d8', '#7209b7', '#fb8b67',
        '#06d6a0', '#ef476f', '#118ab2', '#ffd166', '#8ecae6'
    ];
    const cores = [];
    for (let i = 0; i < numCores; i++) {
        cores.push(paleta[i % paleta.length]);
    }
    return cores;
}

function atualizarGrafico(setoresData) {

    let canvas = document.getElementById('setoresChart');

    if (!canvas) return;

    // Destrói gráfico anterior
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    // Sem dados
    if (!setoresData || setoresData.length === 0) {
        canvas.parentElement.innerHTML = `
            <div class="alert alert-warning mb-0">
                Nenhum dado de atendimento nos últimos 30 dias.
            </div>
        `;
        return;
    }

    // Recria canvas caso tenha sido removido
    if (canvas.parentElement.querySelector('.alert')) {

        canvas.parentElement.innerHTML = `
            <canvas
                id="setoresChart"
                width="400"
                height="250"
                style="max-width:100%; height:auto;">
            </canvas>
        `;

        canvas = document.getElementById('setoresChart');
    }

    const ctx = canvas.getContext('2d');

    const labels = setoresData.map(s => s.setor);
    const data = setoresData.map(s => s.total);
    const colors = gerarCores(setoresData.length);

    currentChart = new Chart(ctx, {

        type: 'bar',

        data: {
            labels,

            datasets: [{
                data,
                backgroundColor: colors,
                borderRadius: 6
            }]
        },

        options: {

            responsive: true,
            maintainAspectRatio: true,

            plugins: {

                legend: {

                    display: true,
                    position: 'top',

                    labels: {

                        generateLabels(chart) {

                            const dataset = chart.data.datasets[0];

                            return chart.data.labels.map((label, i) => {

                                const meta = chart.getDatasetMeta(0);
                                const hidden = meta.data[i]
                                    ? meta.data[i].hidden === true
                                    : false;

                                return {
                                    text: label,
                                    fillStyle: dataset.backgroundColor[i],
                                    strokeStyle: dataset.backgroundColor[i],
                                    hidden,
                                    index: i
                                };
                            });
                        }
                    },

                    onclick(e, legendItem, legend) {

                        const chart = legend.chart;
                        const index = legendItem.index;

                        const meta = chart.getDatasetMeta(0);

                        // Toggle manual
                        meta.data[index].hidden =
                            !meta.data[index].hidden;

                        chart.update();
                    }
                },

                tooltip: {

                    callbacks: {

                        label(context) {
                            return `${context.label}: ${context.raw} atendimentos`;
                        }
                    }
                }
            },

            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function iniciarAutoRefresh(intervalMs = 30000) {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(atualizarDashboardAdmin, intervalMs);
}

function pararAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Função pública (chamada apenas quando a aba Admin é carregada)
window.initAdminDashboard = function () {
    atualizarDashboardAdmin();
    iniciarAutoRefresh(30000);
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}