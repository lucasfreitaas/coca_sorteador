import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  ListOrdered, 
  Coins, 
  Dices, 
  Search, 
  Bell, 
  Settings,
  Plus,
  CheckCircle2,
  Users,
  X,
  History,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import './App.css';
import logo from './assets/logo.bmp';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cocas, setCocas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [winner, setWinner] = useState(null);
  const [confirmData, setConfirmData] = useState(null); // { docId, name }
  const [isAddingCoca, setIsAddingCoca] = useState(false);
  const [user, setUser] = useState(null); // { username, role }

  const API_BASE = `http://${window.location.hostname}:3001`;

  // Login handler
  const handleLogin = (username, password) => {
    if (username.toUpperCase() === 'ADMIN' && password === 'Cais@123') {
      setUser({ username: 'Administrador', role: 'ADMIN' });
      return true;
    } else if (username.toUpperCase() === 'GERAL' && password === '123') {
      setUser({ username: 'Colaborador', role: 'GERAL' });
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('dashboard');
  };

  // Fetch data from local backend
  const fetchCocas = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/cocas`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCocas(data);
        } else {
          console.error("Dados recebidos não são um array:", data);
          setCocas([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro no fetch:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (user) fetchCocas();
  }, [user]);

  // If not logged in, show login page
  if (!user) {
    return <LoginPage onLogin={handleLogin} logo={logo} />;
  }

  // Save New Coca
  const handleSaveNewCoca = async (newCoca) => {
    if (user.role !== 'ADMIN') return;
    try {
      const res = await fetch(`${API_BASE}/api/cocas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCoca)
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddingCoca(false);
        fetchCocas();
      } else {
        alert("Erro ao salvar: " + data.error);
      }
    } catch (err) {
      alert("Erro de conexão ao salvar");
    }
  };

  // Payment Logic
  const handlePay = async (docId, name) => {
    if (user.role !== 'ADMIN') {
      alert("Apenas administradores podem baixar cocas.");
      return;
    }
    setConfirmData({ docId, name });
  };

  const executePay = async () => {
    if (!confirmData) return;
    const { docId } = confirmData;
    
    try {
      const res = await fetch(`${API_BASE}/api/cocas/pay/${docId}`, { method: 'PUT' });
      const data = await res.json();
      if (res.ok) {
        setConfirmData(null);
        fetchCocas(); // Refresh list
        if (selectedPerson) setSelectedPerson(null); // Close modal if open
      } else {
        alert("Erro: " + data.error);
        setConfirmData(null);
      }
    } catch (err) {
      alert("Erro ao processar baixa");
      setConfirmData(null);
    }
  };

  // Draw Logic: Unique names only
  const handleDraw = () => {
    const uniqueNames = Object.keys(groupedCocas);
    if (uniqueNames.length === 0) {
      alert("Ninguém na fila para o sorteio!");
      return;
    }
    const randomIndex = Math.floor(Math.random() * uniqueNames.length);
    const winnerName = uniqueNames[randomIndex];
    setWinner(winnerName);
  };

  // Grouping logic: Unique names, showing most recent (highest ID), counting extras
  const groupedCocas = cocas.reduce((acc, current) => {
    const name = current.RAZAO_SOCIAL;
    if (!acc[name]) {
      acc[name] = {
        main: current,
        others: [],
        count: 1
      };
    } else {
      // Sort: the higher the ID (or lexical order if string), the more recent
      if (current.DOCUMENTO_ID > acc[name].main.DOCUMENTO_ID) {
        acc[name].others.push(acc[name].main);
        acc[name].main = current;
      } else {
        acc[name].others.push(current);
      }
      acc[name].count += 1;
    }
    return acc;
  }, {});

  const displayList = Object.values(groupedCocas).filter(item => 
    item.main.RAZAO_SOCIAL.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chartData = Object.entries(groupedCocas)
    .map(([name, data]) => ({
      name: name.split(' ')[0],
      fullName: name,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 for the chart

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <img src={logo} alt="SIAC Logo" className="company-logo" />
          <div className="logo-text">
            <span>Dynamics</span>
            <small>Coca Control</small>
          </div>
        </div>

        <nav className="nav-menu">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<ListOrdered size={20} />} 
            label="Fila de Cocas" 
            active={activeTab === 'queue'} 
            onClick={() => setActiveTab('queue')} 
          />
          {user.role === 'ADMIN' && (
            <NavItem 
              icon={<Users size={20} />} 
              label="Colaboradores" 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
            />
          )}
        </nav>

        <div className="sidebar-footer">
          <NavItem icon={<Settings size={20} />} label="Configurações" />
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <X size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Pesquisar colaborador..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="header-actions">
            <button className="icon-btn"><Bell size={20} /></button>
            <div className="user-profile">
              <div className="avatar">{user.username.charAt(0)}</div>
              <div className="user-info">
                <span>{user.username}</span>
                <small>{user.role}</small>
              </div>
            </div>
          </div>
        </header>

        <div className="content-scroll">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="dashboard-view"
          >
            <section className="welcome-section">
              <h1>Olá, {user.username} 👋</h1>
              <p>Gerencie a dinâmica de cocas da SIAC conectada ao Oracle.</p>
            </section>

            {/* Stats Grid */}
            <div className="stats-grid">
              <StatCard 
                title="Total Pendente" 
                value={cocas.length} 
                sub="Cocas na fila" 
                icon={<Coins className="text-primary" />}
                trend="Base Oracle"
              />
              <StatCard 
                title="Devedores Únicos" 
                value={Object.keys(groupedCocas).length} 
                sub="Colaboradores" 
                icon={<Users className="text-blue" />}
                trend="Agrupado"
              />
              <StatCard 
                title="Sorteio" 
                value={winner ? "Realizado" : "Próximo"} 
                sub={winner || "Aguardando"} 
                icon={<Dices className="text-green" />}
                trend="Aleatório"
                onClick={handleDraw}
                isButton
              />
            </div>

            {/* Chart Section */}
            <div className="chart-section glass-card">
              <div className="chart-header">
                <h3>Ranking de Devedores</h3>
                <p>Top 8 colaboradores com mais pendências</p>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ 
                        background: '#1a1a1a', 
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: 'var(--primary)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? 'var(--primary)' : 'rgba(244, 0, 0, 0.4)'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Action Row */}
            <div className="action-row">
              <h2>Fila de Pendências</h2>
              <div className="buttons-group">
                <button className="secondary-btn" onClick={handleDraw}>
                  <Dices size={18} /> Sortear Nome
                </button>
                {user.role === 'ADMIN' && (
                  <button className="primary-btn" onClick={() => setIsAddingCoca(true)}>
                    <Plus size={18} /> Novo Registro
                  </button>
                )}
              </div>
            </div>

            {/* Queue Table */}
            <div className="queue-container glass-card">
              {loading ? (
                <div className="loading-state">Carregando dados do Oracle...</div>
              ) : (
                <div className="table-wrapper">
                  <table className="queue-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Motivo (Recente)</th>
                        <th>ID Documento</th>
                        {user.role === 'ADMIN' && <th>Ação</th>}
                        <th className="actions-header">Histórico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayList.map((item) => (
                        <tr key={`${item.main.RAZAO_SOCIAL}-${item.main.DOCUMENTO_ID}-${Math.random()}`}>
                          <td>
                            <div className="user-cell">
                              <div className="mini-avatar">{item.main.RAZAO_SOCIAL.charAt(0)}</div>
                              {item.main.RAZAO_SOCIAL}
                            </div>
                          </td>
                          <td className="reason-cell">{item.main.OBSERVACAO_03 || 'N/A'}</td>
                          <td>#{item.main.DOCUMENTO_ID}</td>
                          {user.role === 'ADMIN' && (
                            <td>
                              <button 
                                className="pay-badge-btn"
                                onClick={() => handlePay(item.main.DOCUMENTO_ID, item.main.RAZAO_SOCIAL)}
                              >
                                Baixar Coca
                              </button>
                            </td>
                          )}
                          <td className="actions-cell">
                            <div className="actions-wrapper">
                              {item.count > 1 ? (
                                <button 
                                  className="plus-count-btn"
                                  onClick={() => setSelectedPerson(item)}
                                  title="Ver todas as cocas"
                                >
                                  <Plus size={12} />
                                  <span>{item.count - 1}</span>
                                </button>
                              ) : (
                                <div className="single-badge"><CheckCircle2 size={16} /></div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Floating Window (Details Modal) */}
      <AnimatePresence>
        {selectedPerson && (
          <DetailsModal 
            person={selectedPerson} 
            onClose={() => setSelectedPerson(null)} 
            onPay={handlePay}
            userRole={user.role}
          />
        )}
      </AnimatePresence>

      {/* Winner Modal */}
      <AnimatePresence>
        {winner && (
          <WinnerModal 
            name={winner} 
            onClose={() => setWinner(null)} 
          />
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmData && (
          <ConfirmModal 
            data={confirmData} 
            onConfirm={executePay}
            onCancel={() => setConfirmData(null)}
          />
        )}
      </AnimatePresence>

      {/* Add Coca Modal */}
      <AnimatePresence>
        {isAddingCoca && (
          <AddCocaModal 
            onClose={() => setIsAddingCoca(false)} 
            onSave={handleSaveNewCoca}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const AddCocaModal = ({ onClose, onSave }) => {
  const [nextId, setNextId] = useState('Carregando...');
  const [collaborators, setCollaborators] = useState([]);
  const [selectedCollab, setSelectedCollab] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const API_BASE = `http://${window.location.hostname}:3001`;
    // Fetch Next ID
    fetch(`${API_BASE}/api/next-id`)
      .then(res => res.json())
      .then(data => setNextId(data.nextId));

    // Fetch Collaborators
    fetch(`${API_BASE}/api/collaborators`)
      .then(res => res.json())
      .then(data => setCollaborators(data));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCollab || !reason) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    onSave({
      docId: nextId,
      cadastroId: selectedCollab,
      reason: reason
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="add-modal glass-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="header-info">
            <Plus size={20} className="text-primary" />
            <h3>Registrar Nova Coca</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="add-form">
          <div className="form-group">
            <label>COCA_ID (Automático)</label>
            <input type="text" value={nextId} disabled className="disabled-input" />
          </div>

          <div className="form-group">
            <label>Colaborador</label>
            <select 
              value={selectedCollab} 
              onChange={(e) => setSelectedCollab(e.target.value)}
              className="form-select"
            >
              <option value="">Selecione um nome...</option>
              {collaborators.map(c => (
                <option key={c.CADASTRO_ID} value={c.CADASTRO_ID}>
                  {c.RAZAO_SOCIAL}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Motivo da Coca</label>
            <textarea 
              placeholder="Ex: celular tocou no suporte"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="modal-footer no-padding">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-btn">Salvar Registro</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const DetailsModal = ({ person, onClose, onPay, userRole }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="modal-overlay"
    onClick={onClose}
  >
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="details-modal glass-card"
      onClick={e => e.stopPropagation()}
    >
      <div className="modal-header">
        <div className="header-info">
          <History size={20} className="text-primary" />
          <h3>Histórico de {person.main.RAZAO_SOCIAL}</h3>
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>
      
      <div className="modal-content">
        <div className="history-list">
          {[person.main, ...person.others].sort((a,b) => b.DOCUMENTO_ID.localeCompare(a.DOCUMENTO_ID)).map((coca, idx) => (
            <div key={`${coca.DOCUMENTO_ID}-${idx}`} className={`history-item ${idx === 0 ? 'recent' : ''}`}>
              <div className="item-id">#{coca.DOCUMENTO_ID}</div>
              <div className="item-details">
                <p className="item-reason">{coca.OBSERVACAO_03 || 'Motivo não especificado'}</p>
                {idx === 0 && <span className="recent-tag">Mais Recente</span>}
              </div>
              {userRole === 'ADMIN' && (
                <button 
                  className="modal-pay-btn"
                  onClick={() => onPay(coca.DOCUMENTO_ID, person.main.RAZAO_SOCIAL)}
                >
                  Baixar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="modal-footer">
        <p>Total: <strong>{person.count} cocas</strong> acumuladas.</p>
        <button className="secondary-btn" onClick={onClose}>Fechar</button>
      </div>
    </motion.div>
  </motion.div>
);

const WinnerModal = ({ name, onClose }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="modal-overlay"
    onClick={onClose}
  >
    <motion.div 
      initial={{ scale: 0.5, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0.5, opacity: 0 }}
      className="winner-modal glass-card"
      onClick={e => e.stopPropagation()}
    >
      <div className="winner-confetti">🎉</div>
      <h2 className="winner-title">Sorteado do Dia!</h2>
      <div className="winner-name-card">
        <span>{name}</span>
      </div>
      <p className="winner-text">Parabéns! Você foi o escolhido para pagar a coca hoje.</p>
      <button className="primary-btn winner-close" onClick={onClose}>Sensacional!</button>
    </motion.div>
  </motion.div>
);

const ConfirmModal = ({ data, onConfirm, onCancel }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="modal-overlay"
    onClick={onCancel}
  >
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="confirm-modal glass-card"
      onClick={e => e.stopPropagation()}
    >
      <div className="confirm-icon">
        <AlertCircle size={40} className="text-primary" />
      </div>
      <h3>Confirmar Baixa?</h3>
      <p>Você está prestes a baixar a coca <strong>#{data.docId}</strong> de <strong>{data.name}</strong>.</p>
      <div className="confirm-actions">
        <button className="secondary-btn" onClick={onCancel}>Cancelar</button>
        <button className="primary-btn" onClick={onConfirm}>Confirmar Baixa</button>
      </div>
    </motion.div>
  </motion.div>
);

const NavItem = ({ icon, label, active, onClick }) => (
  <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    <span>{label}</span>
    {active && <motion.div layoutId="nav-glow" className="nav-glow" />}
  </button>
);

const StatCard = ({ title, value, sub, icon, trend, onClick, isButton }) => (
  <div 
    className={`stat-card glass-card ${isButton ? 'clickable-stat' : ''}`}
    onClick={onClick}
    style={{ cursor: isButton ? 'pointer' : 'default' }}
  >
    <div className="stat-icon">{icon}</div>
    <div className="stat-info">
      <span className="stat-title">{title}</span>
      <h2 className="stat-value">{value}</h2>
      <p className="stat-sub">{sub}</p>
    </div>
    <div className="stat-trend">{trend}</div>
  </div>
);

export default App;

const LoginPage = ({ onLogin, logo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onLogin(username, password)) {
      setError(true);
    }
  };

  return (
    <div className="login-container">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="login-card glass-card"
      >
        <div className="login-header">
          <img src={logo} alt="Logo" className="login-logo" />
          <h2>Coca Dynamics</h2>
          <p>Gestão de Penalidades SIAC</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Usuário</label>
            <input 
              type="text" 
              placeholder="Digite seu usuário..." 
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(false); }}
              required
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="Digite sua senha..." 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              required
            />
          </div>
          {error && <p className="login-error">Usuário ou senha incorretos!</p>}
          <button type="submit" className="primary-btn login-btn">Entrar no Sistema</button>
        </form>
      </motion.div>
    </div>
  );
};
