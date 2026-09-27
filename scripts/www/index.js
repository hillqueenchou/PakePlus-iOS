/* =========================================================
 *  IndexedDB 持久化（带版本升级 + localStorage 兜底）
 * ========================================================= */
let _db = null;
const DB_NAME = 'outfit-app-v2';   // 换新名字，避免旧库结构冲突
const DB_VER  = 1;

function openDB(){
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open(DB_NAME, DB_VER);

    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('kv')) {
        d.createObjectStore('kv');
      }
    };
    r.onsuccess = e => {
      _db = e.target.result;
      // 万一还是缺表（极端情况），关掉重开
      if (!_db.objectStoreNames.contains('kv')) {
        _db.close(); _db = null;
        return rej(new Error('store missing'));
      }
      res(_db);
    };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
}

async function dbSet(k, v){
  try{
    const d = await openDB();
    return new Promise(res => {
      try{
        const tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res;
        tx.onerror = () => {
          // 失败则兜底 localStorage
          try { localStorage.setItem('outfit_' + k, JSON.stringify(v)); } catch(e){}
          res();
        };
      }catch(err){
        try { localStorage.setItem('outfit_' + k, JSON.stringify(v)); } catch(e){}
        res();
      }
    });
  }catch(e){
    try { localStorage.setItem('outfit_' + k, JSON.stringify(v)); } catch(err){}
  }
}

async function dbGet(k){
  try{
    const d = await openDB();
    return new Promise(res => {
      try{
        const tx = d.transaction('kv', 'readonly');
        const rq = tx.objectStore('kv').get(k);
        rq.onsuccess = () => {
          if (rq.result != null) res(rq.result);
          else {
            // idb 无数据，尝试 localStorage
            try {
              const s = localStorage.getItem('outfit_' + k);
              res(s ? JSON.parse(s) : null);
            } catch(e){ res(null); }
          }
        };
        rq.onerror = () => {
          try {
            const s = localStorage.getItem('outfit_' + k);
            res(s ? JSON.parse(s) : null);
          } catch(e){ res(null); }
        };
      }catch(err){
        try {
          const s = localStorage.getItem('outfit_' + k);
          res(s ? JSON.parse(s) : null);
        } catch(e){ res(null); }
      }
    });
  }catch(e){
    try {
      const s = localStorage.getItem('outfit_' + k);
      return s ? JSON.parse(s) : null;
    } catch(err){ return null; }
  }
}
