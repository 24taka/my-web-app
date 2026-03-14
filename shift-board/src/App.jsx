import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Clock, 
  User, 
  Plus, 
  CheckCircle2, 
  XCircle,
  Briefcase,
  AlertCircle,
  Users,
  LogOut,
  ChevronDown,
  Repeat,
  Eye,
  EyeOff
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyBBQ_rwgll4C8iD_WSOZU-94T6C7eWUzcU",
  authDomain: "shift-board-7f8a9.firebaseapp.com",
  projectId: "shift-board-7f8a9",
  storageBucket: "shift-board-7f8a9.firebasestorage.app",
  messagingSenderId: "827782487014",
  appId: "1:827782487014:web:9b90fb2fe394af4a221427",
  measurementId: "G-3HGQL2163M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-shift-board"; // 任意の英数字

export default function App() {
  // システム状態
  const [sysUser, setSysUser] = useState(null);
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);
  
  // アプリケーションデータ
  const [appUsers, setAppUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); 
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // 1. Firebase System Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSysUser(user);
      setIsFirebaseInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!sysUser) return;

    // ユーザー情報の同期
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'appUsers');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() }));
      setAppUsers(usersData);
    }, (error) => console.error("Users sync error:", error));

    // シフト情報の同期
    const shiftsRef = collection(db, 'artifacts', appId, 'public', 'data', 'shifts');
    const unsubShifts = onSnapshot(shiftsRef, (snapshot) => {
      const shiftsData = snapshot.docs.map(doc => ({ ...doc.data() }));
      // ID（タイムスタンプ）の降順でソートして新しいものを上に
      setShifts(shiftsData.sort((a, b) => Number(b.id) - Number(a.id)));
    }, (error) => console.error("Shifts sync error:", error));

    return () => {
      unsubUsers();
      unsubShifts();
    };
  }, [sysUser]);

  // --- 認証ハンドラ ---
  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleRegister = async (userData) => {
    if (!sysUser) return;
    const userId = 'usr_' + Date.now().toString();
    const newUser = {
      ...userData,
      id: userId,
      createdAt: Date.now()
    };
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'appUsers', userId);
    await setDoc(docRef, newUser);
    setCurrentUser(newUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsUserMenuOpen(false);
  };

  // --- ヘルパー関数 ---
  const getAppUser = (id) => appUsers.find(u => u.id === id);

  const getShiftStatusLabel = (status) => {
    switch (status) {
      case 'open': return { text: '募集中', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'filled': return { text: '募集終了', color: 'bg-gray-100 text-gray-800 border-gray-200' };
      case 'cancelled': return { text: '中止', color: 'bg-red-100 text-red-800 border-red-200' };
      default: return { text: '不明', color: 'bg-gray-100 text-gray-800' };
    }
  };

  // --- Firestore操作アクション ---
  const updateShift = async (shift) => {
    if (!sysUser) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'shifts', shift.id.toString());
    await setDoc(docRef, shift);
  };

  const handleCreateShift = async (newShift, type = 'manager') => {
    const shiftId = Date.now().toString();
    const shift = {
      ...newShift,
      id: shiftId,
      status: 'open',
      applicants: [],
      type: type,
      requesterId: currentUser.id
    };
    await updateShift(shift);
  };

  const handleApproveApplicant = async (shiftId, applicantId) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const updatedShift = {
      ...shift,
      status: 'filled',
      applicants: shift.applicants.map(app => 
        app.id === applicantId 
          ? { ...app, status: 'approved' } 
          : { ...app, status: 'rejected' } 
      )
    };
    await updateShift(updatedShift);
  };

  const handleRejectApplicant = async (shiftId, applicantId) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const updatedShift = {
      ...shift,
      applicants: shift.applicants.map(app => 
        app.id === applicantId 
          ? { ...app, status: 'rejected' } 
          : app
      )
    };
    await updateShift(updatedShift);
  };

  const handleApplyShift = async (shiftId) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    if (!shift.applicants.find(a => a.id === currentUser.id)) {
      const updatedShift = {
        ...shift,
        applicants: [...shift.applicants, { id: currentUser.id, name: currentUser.name, status: 'pending' }]
      };
      await updateShift(updatedShift);
    }
  };

  const handleCancelApplication = async (shiftId) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const updatedShift = {
      ...shift,
      applicants: shift.applicants.filter(a => a.id !== currentUser.id)
    };
    await updateShift(updatedShift);
  };

  // --- レンダリング ---
  if (!isFirebaseInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 font-medium flex items-center gap-2">
          <Clock className="animate-spin" size={20} />
          <span>読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen appUsers={appUsers} onLogin={handleLogin} onRegister={handleRegister} />;
  }

  // 同じメールアドレスを持つ別のアカウント（役割違いなど）を取得
  const linkedAccounts = appUsers.filter(u => u.email === currentUser.email && u.id !== currentUser.id);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Users size={28} className="stroke-[2.5]" />
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">シフトヘルプ・ボード</h1>
            <h1 className="text-xl font-bold tracking-tight sm:hidden">シフトボード</h1>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 hover:bg-slate-100 p-2 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-medium text-slate-700">{currentUser.name}</div>
                <div className="text-xs text-slate-500">{currentUser.role === 'manager' ? '管理者' : '従業員'}</div>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50">
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  現在のアカウント
                </div>
                <div className="px-4 py-2 text-sm text-slate-700 border-b border-slate-100 mb-2">
                  <div className="font-bold truncate">{currentUser.name}</div>
                  <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
                  <div className="text-[10px] font-semibold inline-block mt-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                    {currentUser.role === 'manager' ? '管理者' : '従業員'}
                  </div>
                </div>

                {/* 連携アカウント切り替え */}
                {linkedAccounts.length > 0 && (
                  <div className="border-b border-slate-100 pb-2 mb-2">
                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      アカウント切り替え
                    </div>
                    {linkedAccounts.map(account => (
                      <button
                        key={account.id}
                        onClick={() => {
                          setCurrentUser(account);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between transition-colors group"
                      >
                        <div className="truncate pr-2">
                          <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors truncate">
                            {account.name}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {account.role === 'manager' ? '管理者' : '従業員'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut size={16} />
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {currentUser.role === 'manager' ? (
          <ManagerDashboard 
            shifts={shifts} 
            onCreateShift={(data) => handleCreateShift(data, 'manager')}
            onApprove={handleApproveApplicant}
            onReject={handleRejectApplicant}
            getShiftStatusLabel={getShiftStatusLabel}
            getAppUser={getAppUser}
          />
        ) : (
          <EmployeeDashboard 
            currentUser={currentUser}
            shifts={shifts} 
            onCreateShift={(data) => handleCreateShift(data, 'employee')}
            onApply={handleApplyShift}
            onCancel={handleCancelApplication}
            getShiftStatusLabel={getShiftStatusLabel}
            getAppUser={getAppUser}
          />
        )}
      </main>
    </div>
  );
}

// ==========================================
// ログイン / 登録画面
// ==========================================
function AuthScreen({ appUsers, onLogin, onRegister }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('employee');
  const [error, setError] = useState('');

  const validatePassword = (pass) => {
    if (pass.length < 8 || pass.length > 32) {
      return 'パスワードは8文字以上32文字以内で入力してください。';
    }
    if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) {
      return 'パスワードは英字と数字を組み合わせてください。';
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      const user = appUsers.find(u => u.email === email && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError('メールアドレスまたはパスワードが間違っています。');
      }
    } else {
      if (appUsers.some(u => u.email === email && u.role === role)) {
        setError(`このメールアドレスは既に${role === 'manager' ? '管理者' : '従業員'}として登録されています。`);
        return;
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      onRegister({ email, password, name, role });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-md">
        <div className="flex justify-center mb-6 text-indigo-600">
          <Users size={48} className="stroke-[2]" />
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">
          シフトヘルプ・ボード
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">お名前</label>
                <input 
                  type="text" required
                  placeholder="例: 佐藤 スタッフ"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={name} onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">役割</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={role} onChange={e => setRole(e.target.value)}
                >
                  <option value="employee">従業員（スタッフ）</option>
                  <option value="manager">管理者（マネージャー）</option>
                </select>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
            <input 
              type="email" required
              placeholder="email@example.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">パスワード</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} required
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={password} onChange={e => setPassword(e.target.value)}
                minLength={isLogin ? undefined : 8}
                maxLength={isLogin ? undefined : 32}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!isLogin && (
              <p className="text-xs text-slate-500 mt-1.5">
                英字と数字を組み合わせた8〜32文字（記号可）
              </p>
            )}
          </div>

          <button 
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm mt-6"
          >
            {isLogin ? 'ログイン' : 'アカウントを作成'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? 'アカウントをお持ちでないですか？' : 'すでにアカウントをお持ちですか？'}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="ml-2 text-indigo-600 font-semibold hover:underline"
          >
            {isLogin ? '新規登録' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 管理者用ダッシュボード
// ==========================================
function ManagerDashboard({ shifts, onCreateShift, onApprove, onReject, getShiftStatusLabel, getAppUser }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('open');

  const filteredShifts = activeTab === 'open' 
    ? shifts.filter(s => s.status === 'open')
    : shifts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">募集管理</h2>
          <p className="text-slate-500 text-sm mt-1">不足しているシフトの募集と、応募者の承認を行います。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>新規募集を作成</span>
        </button>
      </div>

      <div className="flex space-x-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('open')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'open' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          募集中 ({shifts.filter(s => s.status === 'open').length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          すべての募集 ({shifts.length})
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredShifts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
            該当する募集はありません。
          </div>
        ) : (
          filteredShifts.map(shift => (
            <ManagerShiftCard 
              key={shift.id} 
              shift={shift} 
              onApprove={onApprove}
              onReject={onReject}
              statusLabel={getShiftStatusLabel(shift.status)}
              getAppUser={getAppUser}
            />
          ))
        )}
      </div>

      {isModalOpen && (
        <CreateShiftModal 
          onClose={() => setIsModalOpen(false)} 
          onSubmit={(data) => {
            onCreateShift(data);
            setIsModalOpen(false);
          }} 
        />
      )}
    </div>
  );
}

function ManagerShiftCard({ shift, onApprove, onReject, statusLabel, getAppUser }) {
  const pendingApplicants = shift.applicants.filter(a => a.status === 'pending');
  const approvedApplicant = shift.applicants.find(a => a.status === 'approved');
  const requester = getAppUser(shift.requesterId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="p-5 flex-grow space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className={`w-fit px-2.5 py-1 rounded-md text-xs font-bold border ${statusLabel.color}`}>
              {statusLabel.text}
            </span>
            {shift.type === 'employee' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                <Repeat size={12} />
                {requester?.name || '不明なユーザー'}からの代行依頼
              </span>
            )}
          </div>
          {pendingApplicants.length > 0 && shift.status === 'open' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
              <AlertCircle size={14} />
              未確認の応募が{pendingApplicants.length}件
            </span>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Briefcase size={18} className="text-slate-400" />
            {shift.role}
          </h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" />
              <span>{shift.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span>{shift.startTime} 〜 {shift.endTime}</span>
            </div>
          </div>
        </div>

        {shift.description && (
          <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
            {shift.description}
          </p>
        )}
      </div>

      <div className="bg-slate-50 border-t border-slate-100 p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          応募状況
        </h4>
        
        {shift.applicants.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">まだ応募はありません</p>
        ) : (
          <div className="space-y-2">
            {shift.status === 'filled' && approvedApplicant ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-100 p-2.5 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800 font-medium">
                  <CheckCircle2 size={16} className="text-green-600" />
                  {approvedApplicant.name} (承認済み)
                </div>
              </div>
            ) : (
              shift.applicants.map(applicant => (
                <div key={applicant.id} className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <User size={16} className="text-slate-400" />
                    {applicant.name}
                  </div>
                  {applicant.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onReject(shift.id, applicant.id)}
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold transition-colors"
                      >
                        再募集
                      </button>
                      <button
                        onClick={() => onApprove(shift.id, applicant.id)}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md text-xs font-semibold transition-colors"
                      >
                        承認する
                      </button>
                    </div>
                  )}
                  {applicant.status === 'rejected' && (
                    <span className="text-xs text-slate-400 px-2">見送り</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 従業員用ダッシュボード
// ==========================================
function EmployeeDashboard({ currentUser, shifts, onCreateShift, onApply, onCancel, getShiftStatusLabel, getAppUser }) {
  const [activeTab, setActiveTab] = useState('available');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const myApplications = shifts.filter(s => s.applicants.some(a => a.id === currentUser.id));
  const myRequests = shifts.filter(s => s.type === 'employee' && s.requesterId === currentUser.id);
  const availableShifts = shifts.filter(s => 
    s.status === 'open' && 
    !s.applicants.some(a => a.id === currentUser.id) &&
    s.requesterId !== currentUser.id 
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ヘルプを探す・依頼する</h2>
          <p className="text-slate-500 text-sm mt-1">人手が不足しているシフトに応募したり、自分の代行を依頼できます。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Repeat size={18} />
          <span>代行依頼を作成</span>
        </button>
      </div>

      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('available')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'available' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          募集中のシフト
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'available' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
            {availableShifts.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('my_applications')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'my_applications' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          あなたの応募履歴
          {myApplications.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'my_applications' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
              {myApplications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my_requests')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'my_requests' 
              ? 'border-purple-600 text-purple-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          あなたの代行依頼
          {myRequests.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'my_requests' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
              {myRequests.length}
            </span>
          )}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeTab === 'available' ? (
          availableShifts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
              現在、募集中のシフトはありません。
            </div>
          ) : (
            availableShifts.map(shift => (
              <EmployeeShiftCard 
                key={shift.id} 
                shift={shift} 
                onApply={onApply}
                statusLabel={getShiftStatusLabel(shift.status)}
                mode="available"
                getAppUser={getAppUser}
              />
            ))
          )
        ) : activeTab === 'my_applications' ? (
          myApplications.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
              まだ応募したシフトはありません。
            </div>
          ) : (
            myApplications.map(shift => {
              const myApp = shift.applicants.find(a => a.id === currentUser.id);
              return (
                <EmployeeShiftCard 
                  key={shift.id} 
                  shift={shift} 
                  onCancel={onCancel}
                  myStatus={myApp?.status}
                  statusLabel={getShiftStatusLabel(shift.status)}
                  mode="applied"
                  getAppUser={getAppUser}
                />
              )
            })
          )
        ) : (
          myRequests.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
              現在、代行を依頼しているシフトはありません。
            </div>
          ) : (
            myRequests.map(shift => (
              <EmployeeShiftCard 
                key={shift.id} 
                shift={shift} 
                statusLabel={getShiftStatusLabel(shift.status)}
                mode="my_request"
                getAppUser={getAppUser}
              />
            ))
          )
        )}
      </div>

      {isModalOpen && (
        <CreateShiftModal 
          onClose={() => setIsModalOpen(false)} 
          onSubmit={(data) => {
            onCreateShift(data);
            setIsModalOpen(false);
          }} 
          title="新規代行依頼"
          submitText="代行を依頼する"
          descriptionPlaceholder="代わってほしい理由や、引き継ぎ事項などを記入してください。"
        />
      )}
    </div>
  );
}

function EmployeeShiftCard({ shift, onApply, onCancel, myStatus, statusLabel, mode, getAppUser }) {
  const requester = getAppUser(shift.requesterId);
  
  const getMyStatusDisplay = () => {
    switch (myStatus) {
      case 'pending': return { text: '承認待ち', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: <Clock size={16} /> };
      case 'approved': return { text: '承認されました！', color: 'text-green-700 bg-green-50 border-green-200', icon: <CheckCircle2 size={16} /> };
      case 'rejected': return { text: '見送り', color: 'text-slate-500 bg-slate-100 border-slate-200', icon: <XCircle size={16} /> };
      default: return null;
    }
  };

  const myStatusDisplay = mode === 'applied' ? getMyStatusDisplay() : null;

  return (
    <div className={`bg-white rounded-2xl border ${myStatus === 'approved' ? 'border-green-300 shadow-green-100' : 'border-slate-200'} shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative`}>
      {myStatus === 'approved' && (
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
      )}

      <div className="p-5 flex-grow space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className={`w-fit px-2.5 py-1 rounded-md text-xs font-bold border ${statusLabel.color}`}>
              {statusLabel.text}
            </span>
            {shift.type === 'employee' && mode !== 'my_request' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                <Repeat size={12} />
                {requester?.name || '不明なユーザー'}からの代行依頼
              </span>
            )}
            {mode === 'my_request' && shift.applicants.length > 0 && shift.status === 'open' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                <AlertCircle size={14} />
                {shift.applicants.length}件の応募（承認待ち）
              </span>
            )}
          </div>
          {myStatusDisplay && (
            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md border ${myStatusDisplay.color}`}>
              {myStatusDisplay.icon}
              {myStatusDisplay.text}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Briefcase size={18} className={myStatus === 'approved' ? 'text-green-500' : 'text-indigo-500'} />
            {shift.role}
          </h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" />
              <span className="font-medium">{shift.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span>{shift.startTime} 〜 {shift.endTime}</span>
            </div>
          </div>
        </div>

        {shift.description && (
          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed">
            {shift.description}
          </p>
        )}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100">
        {mode === 'available' ? (
          <button
            onClick={() => onApply(shift.id)}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            このシフトに応募する
          </button>
        ) : mode === 'applied' ? (
          <div className="flex flex-col gap-2">
            {myStatus === 'pending' && (
              <button
                onClick={() => onCancel(shift.id)}
                className="w-full py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                応募をキャンセル
              </button>
            )}
            {myStatus === 'approved' && (
              <p className="text-xs text-center text-slate-500 font-medium">
                当日はよろしくお願いします！
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            {shift.status === 'open' ? (
              <p className="text-sm text-slate-500 font-medium">管理者の承認を待っています</p>
            ) : (
              <p className="text-sm text-green-600 font-bold flex justify-center items-center gap-1">
                <CheckCircle2 size={16} /> 代行が確定しました
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 募集作成モーダル
function CreateShiftModal({ onClose, onSubmit, title = "新規ヘルプ募集", submitText = "募集を公開する", descriptionPlaceholder = "募集の背景や、必要なスキルなどがあれば記入してください。" }) {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    role: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XCircle size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">日付 <span className="text-red-500">*</span></label>
            <input 
              type="date" 
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">開始時間 <span className="text-red-500">*</span></label>
              <input 
                type="time" 
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">終了時間 <span className="text-red-500">*</span></label>
              <input 
                type="time" 
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">役割 / ポジション <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="例: ホールスタッフ、キッチン"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">詳細・メッセージ</label>
            <textarea 
              rows="3"
              placeholder={descriptionPlaceholder}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            ></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}