document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Utility / Persistence (API version)
     ========================= */
  
  // ** ⚠️ IMPORTANTE: Mude esta URL para o endereço do seu servidor de backend! **
  const API_URL = 'http://localhost:3000/api'; 

  const moneyFormat = value => {
    if (typeof value !== "number") value = parseFloat(String(value).replace(/[^0-9.-]+/g,"")) || 0;
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };
  const parseNumber = v => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    return parseFloat(String(v).replace(/\./g,"").replace(",",".").replace(/[^0-9.-]+/g,"")) || 0;
  };

  // Função auxiliar para fazer chamadas à API com autenticação
  const authenticatedFetch = async (endpoint, options = {}) => {
      const token = localStorage.getItem("authToken");
      if (!token) {
          alert("Sessão expirada. Faça login novamente.");
          window.location.href = "index.html";
          throw new Error("Missing Auth Token");
      }

      const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers
      };

      const response = await fetch(`${API_URL}/${endpoint}`, { ...options, headers });

      if (response.status === 401) {
          alert("Não autorizado. Faça login novamente.");
          localStorage.removeItem("authToken");
          window.location.href = "index.html";
          throw new Error("Unauthorized");
      }
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(`API Error: ${errorData.message || response.statusText}`);
      }
      return response.json();
  };

  /* Variáveis globais (Dados carregados da API) */
  let contas = [];
  let categorias = [];
  let transacoes = [];
  let connectedBanks = [];
  let userInfo = {};
  
  // A função saveAll (do localStorage) foi removida, pois a persistência é feita via API.

  /* =========================
     Load Data from API
     ========================= */

  const loadUserData = async () => {
      try {
          // Endpoint que o backend deve fornecer com todos os dados do usuário logado
          const data = await authenticatedFetch('data/all'); 
          contas = data.contas || [];
          categorias = data.categorias || [];
          transacoes = data.transacoes || [];
          connectedBanks = data.connectedBanks || [];
          userInfo = data.user || {};

          // Chame sua função de inicialização UI aqui
          inicializarUI(); 

      } catch (error) {
          console.error("Falha ao carregar dados do usuário:", error);
      }
  };


  /* =========================
     Theme toggle (EXISTENTE)
     ========================= */
  const themeToggle = document.getElementById("theme-toggle");
  const currentTheme = localStorage.getItem("theme");
  if (currentTheme) {
    document.body.classList.add(currentTheme);
  }

  themeToggle && themeToggle.addEventListener("click", () => {
    if (document.body.classList.contains("dark")) {
      document.body.classList.remove("dark");
      document.body.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.body.classList.remove("light");
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  });

  /* =========================
     Logout (EXISTENTE - MANTIDO)
     ========================= */
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn && logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("authToken"); // Remove o novo token de segurança
    window.location.href = "index.html";
  });

  /* =========================
     Menu Navigation (EXISTENTE - MANTIDO)
     ========================= */
  const menuItems = document.querySelectorAll(".menu-item");
  const sections = document.querySelectorAll(".section");

  const showSection = target => {
    sections.forEach(section => {
      if (section.id === target) {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });

    menuItems.forEach(item => {
      item.classList.remove("active");
      if (item.dataset.section === target) {
        item.classList.add("active");
      }
    });
    // Re-render chart on dashboard switch
    if (target === 'dashboard') atualizarResumo();
  };

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      showSection(item.dataset.section);
    });
  });

  /* =========================
     Conta Management (ATUALIZADO PARA API)
     ========================= */
  
  const atualizarTransferSelects = () => {
    const transferFromSelect = document.getElementById("transfer-from");
    const transferToSelect = document.getElementById("transfer-to");
    
    if (transferFromSelect) {
        transferFromSelect.innerHTML = contas.map(c => `<option value="${c.id}">${c.nome} (${moneyFormat(c.saldo)})</option>`).join('');
    }
    if (transferToSelect) {
        transferToSelect.innerHTML = contas.map(c => `<option value="${c.id}">${c.nome} (${moneyFormat(c.saldo)})</option>`).join('');
    }
  };


  const atualizarContas = () => {
    // Sua lógica original de UI para exibir as contas
    const listaContas = document.getElementById("lista-contas");
    if (!listaContas) return;
    listaContas.innerHTML = "";
    contas.forEach(c => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `<div><strong>${c.nome}</strong><div class="small muted">${moneyFormat(c.saldo)}</div></div><div class="list-actions"><button class="btn xs danger" onclick="deleteConta(${c.id})">Excluir</button></div>`;
      listaContas.appendChild(li);
    });

    // Atualizar selects de transação
    const contaSelect = document.getElementById("conta-selecionada");
    if(contaSelect) {
        contaSelect.innerHTML = contas.map(c => `<option value="${c.id}">${c.nome} (${moneyFormat(c.saldo)})</option>`).join('');
    }
    atualizarTransferSelects();
  };
  
  // Função que usa o formulário para adicionar a conta (modificada para ser assíncrona)
  const contaForm = document.getElementById("conta-form");
  if (contaForm) {
    contaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = document.getElementById("conta-nome").value.trim();
      const saldo = parseNumber(document.getElementById("conta-saldo").value);

      if (!nome || isNaN(saldo)) return alert("Preencha todos os campos corretamente.");

      try {
          const newAccount = { nome, saldo };
          await authenticatedFetch('contas', {
              method: 'POST',
              body: JSON.stringify(newAccount)
          });
          alert("Conta adicionada com sucesso!");
          contaForm.reset();
          await loadUserData(); // Recarrega para obter ID e saldos atualizados
      } catch (error) {
          console.error("Erro ao adicionar conta:", error);
          alert("Erro ao adicionar conta. Verifique o console.");
      }
    });
  }

  // Função global para excluir conta (modificada para ser assíncrona)
  window.deleteConta = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta conta? Todas as transações associadas serão perdidas.')) return;
    try {
        await authenticatedFetch(`contas/${id}`, { method: 'DELETE' });
        alert("Conta excluída com sucesso!");
        await loadUserData(); // Recarrega para sincronia total
    } catch (error) {
        console.error("Erro ao excluir conta:", error);
        alert("Erro ao excluir conta. Verifique o console.");
    }
  };

  /* =========================
     Category Management (ATUALIZADO PARA API)
     ========================= */
  const atualizarCategorias = () => {
    // Sua lógica original de UI para exibir as categorias
    const listaCategorias = document.getElementById("lista-categorias");
    if (!listaCategorias) return;
    listaCategorias.innerHTML = "";
    categorias.forEach(c => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `<div><strong>${c.nome}</strong></div><div class="list-actions"><button class="btn xs danger" onclick="deleteCategoria('${c.id}')">Excluir</button></div>`;
      listaCategorias.appendChild(li);
    });

    // Atualizar selects de transação
    const categoriaSelect = document.getElementById("categoria-selecionada");
    if(categoriaSelect) {
        categoriaSelect.innerHTML = categorias.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        categoriaSelect.innerHTML += '<option value="Transferência">Transferência</option>';
    }
  };

  // Função que usa o formulário para adicionar a categoria (modificada para ser assíncrona)
  const categoriaForm = document.getElementById("categoria-form");
  if (categoriaForm) {
    categoriaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = document.getElementById("categoria-nome").value.trim();

      if (!nome) return alert("Preencha o nome da categoria.");
      if (categorias.find(c => c.nome.toLowerCase() === nome.toLowerCase())) return alert("Esta categoria já existe.");

      try {
        const newCategory = { nome }; // ID deve ser gerado no backend
        await authenticatedFetch('categorias', {
            method: 'POST',
            body: JSON.stringify(newCategory)
        });
        alert("Categoria adicionada com sucesso!");
        categoriaForm.reset();
        await loadUserData(); // Recarrega para sincronia total
      } catch (error) {
        console.error("Erro ao adicionar categoria:", error);
        alert("Erro ao adicionar categoria. Verifique o console.");
      }
    });
  }

  // Função global para excluir categoria (modificada para ser assíncrona)
  window.deleteCategoria = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? As transações associadas não serão removidas.')) return;
    try {
        await authenticatedFetch(`categorias/${id}`, { method: 'DELETE' });
        alert("Categoria excluída com sucesso!");
        await loadUserData(); // Recarrega para sincronia total
    } catch (error) {
        console.error("Erro ao excluir categoria:", error);
        alert("Erro ao excluir categoria. Verifique o console.");
    }
  };

  /* =========================
     Transaction Management (ATUALIZADO PARA API)
     ========================= */
  const atualizarTabela = () => {
    // Sua lógica original de UI para exibir as transações
    const transactionList = document.getElementById("transaction-list");
    if (!transactionList) return;
    transactionList.innerHTML = "";

    // Ordenar por data mais recente
    const sortedTransactions = [...transacoes].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTransactions.forEach(t => {
      const conta = contas.find(c => c.id == t.contaId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.desc}</td>
        <td class="${t.type === 'entrada' ? 'text-success' : 'text-danger'}">${t.type.toUpperCase()}</td>
        <td class="${t.type === 'entrada' ? 'text-success' : 'text-danger'}">${moneyFormat(t.amount)}</td>
        <td>${conta ? conta.nome : 'Conta Removida'}</td>
        <td>${t.categoria}</td>
        <td><button class="btn xs danger" onclick="deleteTransaction(${t.id})">Excluir</button></td>
      `;
      transactionList.appendChild(tr);
    });
  };

  // Função que usa o formulário para adicionar transação (modificada para ser assíncrona)
  const transactionForm = document.getElementById("transaction-form");
  if (transactionForm) {
    transactionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const desc = document.getElementById("desc").value.trim();
      const amount = parseNumber(document.getElementById("amount").value);
      const type = document.getElementById("type").value;
      const contaId = document.getElementById("conta-selecionada").value;
      const categoria = document.getElementById("categoria-selecionada").value;
      const date = document.getElementById("date").value;

      if (!desc || isNaN(amount) || amount <= 0 || !contaId || !categoria || !date) {
        return alert("Preencha todos os campos corretamente.");
      }
      
      // A transação original tem um ID Date.now() no frontend. O backend deve gerar o ID.
      const newTransaction = { desc, amount, type, date, contaId: parseInt(contaId), categoria };

      try {
        await authenticatedFetch('transacoes', {
            method: 'POST',
            body: JSON.stringify(newTransaction)
        });
        alert('Transação adicionada com sucesso!');
        transactionForm.reset();
        await loadUserData(); // Recarrega para obter saldos e transações atualizados
      } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        alert("Erro ao adicionar transação. Verifique o console.");
      }
    });
  }

  // Função global para excluir transação (modificada para ser assíncrona)
  window.deleteTransaction = async (id) => {
    if (!confirm('Excluir esta transação?')) return;
    try {
        await authenticatedFetch(`transacoes/${id}`, { method: 'DELETE' });
        alert('Transação excluída.');
        await loadUserData(); // Recarrega para obter saldos e transações atualizados
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        alert("Erro ao excluir transação. Verifique o console.");
    }
  };


  /* =========================
     Transfer Management (ATUALIZADO PARA API)
     ========================= */
  const transferForm = document.getElementById("transfer-form");
  if (transferForm) {
    transferForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fromId = document.getElementById("transfer-from").value;
      const toId = document.getElementById("transfer-to").value;
      const amount = parseNumber(document.getElementById("transfer-amount").value);
      
      if (!fromId || !toId || isNaN(amount) || amount <= 0) {
        return alert("Preencha todos os campos corretamente.");
      }

      if (fromId === toId) return alert("Conta de origem e destino devem ser diferentes.");

      const from = contas.find(c => c.id == fromId);
      if (from.saldo < amount) return alert(`Saldo insuficiente na conta ${from.nome}.`);
      
      const date = new Date().toISOString().slice(0,10);
      
      const transferData = {
          fromId: parseInt(fromId),
          toId: parseInt(toId),
          amount,
          date
      };

      try {
        await authenticatedFetch('transacoes/transfer', {
            method: 'POST',
            body: JSON.stringify(transferData)
        });
        transferForm.reset();
        alert('Transferência realizada com sucesso.');
        await loadUserData(); // Recarrega para obter saldos e transações atualizados
      } catch (error) {
        console.error("Erro ao realizar transferência:", error);
        alert("Erro ao realizar transferência. Verifique o console.");
      }
    });
  }


  /* =========================
     Simulated Bank Import (ATUALIZADO PARA API)
     ========================= */

  // Função global para simular importação (usada em connect.html)
  window.simulateBankImport = async (bankName, numTransactions) => {
    if (!contas.length) return alert("Crie pelo menos uma conta antes de simular a conexão bancária.");

    // Enviar dados para o backend para que ele gere as transações e a conexão
    try {
        // Assume que a transação de simulação será na primeira conta
        await authenticatedFetch('connect/simulate', {
            method: 'POST',
            body: JSON.stringify({ bankName, numTransactions, contaId: contas[0].id })
        });
        // Não alerta aqui, a página connect.html lida com o redirecionamento/alerta
        await loadUserData(); // Recarrega para obter novos dados e conexão
    } catch (error) {
        console.error("Erro na simulação:", error);
        alert("Erro na simulação da conexão bancária.");
    }
  };

  /* =========================
     Dashboard Charts (EXISTENTE - MANTIDO)
     ========================= */
  let lineChart, pieChart;
  const ctxLine = document.getElementById('lineChart');
  const ctxPie = document.getElementById('pieChart');

  const getChartData = () => {
    // Sua lógica original de cálculo de dados de gráfico
    const resumo = transacoes.reduce((acc, t) => {
        const monthYear = t.date.slice(0, 7);
        if (!acc.months[monthYear]) {
            acc.months[monthYear] = { entrada: 0, saida: 0 };
        }
        if (t.type === 'entrada') {
            acc.months[monthYear].entrada += t.amount;
        } else if (t.type === 'saida') {
            acc.months[monthYear].saida += t.amount;
            
            // Pie data (by category for 'saida')
            if (t.categoria !== 'Transferência') { // Excluir transferências
                if (!acc.categories[t.categoria]) {
                    acc.categories[t.categoria] = 0;
                }
                acc.categories[t.categoria] += t.amount;
            }
        }
        return acc;
    }, { months: {}, categories: {} });

    // Prepara dados para o gráfico de linha (histórico)
    const sortedMonths = Object.keys(resumo.months).sort();
    const lineData = {
        labels: sortedMonths,
        datasets: [{
            label: 'Receitas',
            data: sortedMonths.map(m => resumo.months[m].entrada),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.3
        }, {
            label: 'Despesas',
            data: sortedMonths.map(m => resumo.months[m].saida * -1), // Despesas negativas para melhor visualização
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            fill: true,
            tension: 0.3
        }]
    };
    
    // Prepara dados para o gráfico de pizza (despesas por categoria)
    const pieLabels = Object.keys(resumo.categories);
    const pieValues = pieLabels.map(l => resumo.categories[l]);
    const pieData = {
        labels: pieLabels,
        datasets: [{
            data: pieValues,
            backgroundColor: [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
            ],
        }]
    };
    
    return { lineData, pieData, totalEntrada: resumo.months.totalEntrada, totalSaida: resumo.months.totalSaida };
  };

  const atualizarResumo = () => {
    // Sua lógica original de UI para o resumo
    const totalBalance = contas.reduce((sum, c) => sum + c.saldo, 0);
    const dashboardTitle = document.getElementById("total-balance");
    if (dashboardTitle) dashboardTitle.textContent = moneyFormat(totalBalance);
    
    // Gráficos
    const { lineData, pieData } = getChartData();

    // 1. Line Chart (Historical)
    if (ctxLine && lineData.labels.length > 0) {
        if (lineChart) lineChart.destroy();
        lineChart = new Chart(ctxLine, {
            type: 'line',
            data: lineData,
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => moneyFormat(v) }
                    }
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: c => `${c.dataset.label}: ${moneyFormat(c.raw)}` } }
                }
            }
        });
    } else if (ctxLine && lineChart) {
        lineChart.destroy(); // Oculta se não houver dados
    }

    // 2. Pie Chart (Categories)
    if (ctxPie && pieData.labels.length > 0) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(ctxPie, {
            type: 'pie',
            data: pieData,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    datalabels: {
                        formatter: (value, ctx) => {
                            let sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            let percentage = Math.round((value / sum) * 100) + '%';
                            return percentage;
                        },
                        color: '#fff',
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    } else if (ctxPie && pieChart) {
        pieChart.destroy(); // Oculta se não houver dados
    }
  };


  /* =========================
     Inicialização (ATUALIZADO PARA API)
     ========================= */
  function inicializarUI() {
    // Atualiza info do usuário na sidebar
    if (document.getElementById("user-name")) {
        document.getElementById("user-name").textContent = userInfo.nome || 'Usuário';
        document.getElementById("user-email").textContent = localStorage.getItem("loggedUser");
    }
    // Suas chamadas originais para atualizar a UI com os dados carregados:
    atualizarContas(); 
    atualizarCategorias(); 
    atualizarTabela(); 
    atualizarResumo();
  }

  // Inicia o carregamento de dados da API ao carregar o dashboard
  if (document.querySelector('.app')) {
      // Verifica se o token existe antes de tentar carregar dados
      if (localStorage.getItem("authToken")) {
          loadUserData(); 
      } else {
          // Se não houver token, redireciona para login (redundante, mas seguro)
          window.location.href = "index.html"; 
      }
  }

}); // DOMContentLoaded end

// Disconnect bank helper (global) (ATUALIZADO PARA API)
window.disconnectBank = async function(id){
  if (!confirm('Desconectar esta conta? As transações importadas não serão removidas automaticamente.')) return;
  try {
      const API_URL = 'http://localhost:3000/api';
      const token = localStorage.getItem("authToken");

      // DELETE para a API
      await fetch(`${API_URL}/connect/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Conta bancária desconectada.');
      // Simula a recarga de dados do loadUserData() para atualizar a lista
      location.reload(); 
  } catch (error) {
      console.error("Erro ao desconectar conta:", error);
      alert("Erro ao desconectar conta. Verifique o console.");
  }
}