/* =====================================================================
 *  RepoVault — CONFIGURE SUAS CREDENCIAIS AQUI (e somente aqui)
 * =====================================================================
 *  1) Firebase → Console do Firebase > Configurações do projeto > Seus apps (Web)
 *  2) Google Drive → Google Cloud Console > APIs e serviços > Credenciais
 *     - API Key  (chave de API)
 *     - OAuth Client ID (tipo "Aplicativo da Web") — OBRIGATÓRIO para upload,
 *       a API Key sozinha não autoriza gravar no seu Drive.
 *       Adicione a origem do site em "Origens JavaScript autorizadas".
 * ===================================================================== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAebDd0ZGbaTLGGSG6N3HP247gS7Qn1e_g",
  authDomain: "repo-81f2f.firebaseapp.com",
  databaseURL: "https://repo-81f2f-default-rtdb.firebaseio.com",
  projectId: "repo-81f2f",
  storageBucket: "repo-81f2f.firebasestorage.app",
  messagingSenderId: "744680583759",
  appId: "1:744680583759:web:a47c985c4ae08d5c7b703a",
};

const GOOGLE_DRIVE_API_KEY = "AIzaSyDHkLh2vGgxUJpVo11o1kKqtH1DQ5Toeu4";
const GOOGLE_OAUTH_CLIENT_ID = "271164112354-ikr1ch05fcv9astro58hvqp18f216mbs.apps.googleusercontent.com";
const DRIVE_FOLDER_NAME = "RepoVault Backups";

/* ===================== FIM DA CONFIGURAÇÃO ===================== */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const el = (id) => document.getElementById(id);
const ui = {
  loginBtn: el("loginBtn"),
  logoutBtn: el("logoutBtn"),
  userBox: el("userBox"),
  userName: el("userName"),
  userPhoto: el("userPhoto"),
  signedOut: el("signedOut"),
  signedIn: el("signedIn"),
  addForm: el("addForm"),
  repoUrl: el("repoUrl"),
  addError: el("addError"),
  repoList: el("repoList"),
  repoCount: el("repoCount"),
  emptyState: el("emptyState"),
  downloadAllBtn: el("downloadAllBtn"),
  driveToggle: el("driveToggle"),
  log: el("log"),
};

function log(message) {
  const time = new Date().toLocaleTimeString();
  ui.log.textContent = `[${time}] ${message}\n` + ui.log.textContent;
}

function showError(message) {
  ui.addError.textContent = message;
  ui.addError.classList.toggle("hidden", !message);
}

/* ---------------------------- Firebase ---------------------------- */

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();
let currentUser = null;
let reposRef = null;
let repos = [];

ui.loginBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope("email");
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    log(`Falha no login: ${err.message}`);
  }
});

ui.logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged((user) => {
  currentUser = user;
  const signedIn = Boolean(user);

  ui.loginBtn.classList.toggle("hidden", signedIn);
  ui.logoutBtn.classList.toggle("hidden", !signedIn);
  ui.userBox.classList.toggle("hidden", !signedIn);
  ui.signedIn.classList.toggle("hidden", !signedIn);
  ui.signedOut.classList.toggle("hidden", signedIn);

  if (reposRef) {
    reposRef.off();
    reposRef = null;
  }

  if (!signedIn) {
    repos = [];
    renderRepos();
    return;
  }

  ui.userName.textContent = user.displayName || user.email;
  ui.userPhoto.src = user.photoURL || "";
  log(`Conectado como ${user.email}`);

  reposRef = db.ref(`users/${user.uid}/repos`);
  reposRef.on(
    "value",
    (snap) => {
      const value = snap.val() || {};
      repos = Object.entries(value)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      renderRepos();
    },
    (err) => log(`Erro ao ler o banco: ${err.message}`),
  );
});

/* ------------------------- Lista de repos ------------------------- */

function parseRepo(raw) {
  const value = raw.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  let match = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (!match) match = value.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

ui.addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  const parsed = parseRepo(ui.repoUrl.value);
  if (!parsed) {
    showError("Use uma URL do GitHub, ex.: https://github.com/usuario/repositorio");
    return;
  }
  const fullName = `${parsed.owner}/${parsed.name}`;
  if (repos.some((repo) => repo.fullName.toLowerCase() === fullName.toLowerCase())) {
    showError("Esse repositório já está salvo.");
    return;
  }
  try {
    await reposRef.push({
      fullName,
      owner: parsed.owner,
      name: parsed.name,
      url: `https://github.com/${fullName}`,
      createdAt: Date.now(),
    });
    ui.repoUrl.value = "";
    log(`Salvo: ${fullName}`);
  } catch (err) {
    showError(`Não foi possível salvar: ${err.message}`);
  }
});

function renderRepos() {
  ui.repoCount.textContent = String(repos.length);
  ui.emptyState.classList.toggle("hidden", repos.length > 0);
  ui.downloadAllBtn.disabled = repos.length === 0;
  ui.repoList.innerHTML = "";

  repos.forEach((repo) => {
    const li = document.createElement("li");
    li.className = "repo-item";

    const left = document.createElement("div");
    const link = document.createElement("a");
    link.href = repo.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = repo.fullName;
    const meta = document.createElement("div");
    meta.className = "repo-meta";
    meta.textContent = repo.createdAt
      ? `adicionado em ${new Date(repo.createdAt).toLocaleDateString()}`
      : "";
    left.append(link, meta);

    const right = document.createElement("div");
    right.className = "actions";

    const dl = document.createElement("button");
    dl.className = "btn btn-ghost btn-sm";
    dl.textContent = "Baixar";
    dl.addEventListener("click", () => backupRepos([repo]));

    const rm = document.createElement("button");
    rm.className = "btn btn-ghost btn-sm";
    rm.textContent = "Remover";
    rm.addEventListener("click", () => reposRef.child(repo.id).remove());

    right.append(dl, rm);
    li.append(left, right);
    ui.repoList.append(li);
  });
}

/* --------------------------- Google Drive -------------------------- */

let driveTokenClient = null;
let driveAccessToken = null;
let driveFolderId = null;

function getDriveToken() {
  return new Promise((resolve, reject) => {
    if (driveAccessToken) return resolve(driveAccessToken);
    if (!window.google?.accounts?.oauth2) {
      return reject(new Error("Google Identity Services não carregou."));
    }
    if (!driveTokenClient) {
      driveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error) return reject(new Error(response.error));
          driveAccessToken = response.access_token;
          resolve(driveAccessToken);
        },
      });
    }
    driveTokenClient.requestAccessToken({
      prompt: "",
      hint: currentUser?.email || undefined,
    });
  });
}

async function driveFetch(url, options = {}) {
  const token = await getDriveToken();
  const withKey = url + (url.includes("?") ? "&" : "?") + `key=${encodeURIComponent(GOOGLE_DRIVE_API_KEY)}`;
  const res = await fetch(withKey, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ensureDriveFolder() {
  if (driveFolderId) return driveFolderId;
  const query = encodeURIComponent(
    `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const found = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
  );
  if (found.files?.length) {
    driveFolderId = found.files[0].id;
    return driveFolderId;
  }
  const created = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  driveFolderId = created.id;
  log(`Pasta "${DRIVE_FOLDER_NAME}" criada no Drive.`);
  return driveFolderId;
}

async function uploadToDrive(fileName, blob) {
  const folderId = await ensureDriveFolder();
  const token = await getDriveToken();
  const metadata = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name&key=${encodeURIComponent(GOOGLE_DRIVE_API_KEY)}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
  );
  if (!res.ok) throw new Error(`Upload falhou ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ---------------------------- Download ---------------------------- */

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// O GitHub (codeload) não envia cabeçalhos CORS, então o download passa por
// um proxy. Se este app estiver hospedado em outro lugar (ex.: GitHub Pages),
// o caminho relativo não existe lá e o GitHub responde 404 ("Site not found").
// Por isso usamos a URL ABSOLUTA do proxy de desenvolvimento do Lovable.
// Troque abaixo se você hospedar o proxy em outro domínio.
const ZIP_PROXY = "https://project--c48153c9-a9f2-4c94-a783-aea5b699c060-dev.lovable.app/api/public/repo-zip";

async function fetchRepoZip(repo) {
  const res = await fetch(`${ZIP_PROXY}?repo=${encodeURIComponent(repo.fullName)}`);
  if (!res.ok) {
    const body = (await res.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(`Falha ao baixar ${repo.fullName} (${res.status}: ${body})`);
  }
  const branch = res.headers.get("X-Repo-Branch") || "backup";
  const blob = await res.blob();
  return { blob, fileName: `${repo.owner}-${repo.name}-${branch}.zip` };
}


async function backupRepos(list) {
  const toDrive = ui.driveToggle.checked;
  ui.downloadAllBtn.disabled = true;
  log(`Iniciando backup de ${list.length} repositório(s)${toDrive ? " + Drive" : ""}...`);

  for (const repo of list) {
    try {
      log(`Baixando ${repo.fullName}...`);
      const { blob, fileName } = await fetchRepoZip(repo);
      saveBlob(blob, fileName);
      log(`OK: ${fileName} (${(blob.size / 1048576).toFixed(2)} MB)`);
      if (toDrive) {
        const uploaded = await uploadToDrive(fileName, blob);
        log(`Enviado ao Drive: ${uploaded.name}`);
      }
    } catch (err) {
      log(`Erro em ${repo.fullName}: ${err.message}`);
    }
  }

  log("Backup concluído.");
  ui.downloadAllBtn.disabled = repos.length === 0;
}


/* ------------------- Carregamento robusto do JSZip -------------------
 * O <script> do CDN pode falhar (bloqueio de rede, offline, adblock).
 * Aqui tentamos vários CDNs sob demanda antes de desistir. */
const JSZIP_CDNS = [
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(s);
  });
}

let jszipPromise = null;
async function ensureJSZip() {
  if (typeof window.JSZip !== "undefined") return window.JSZip;
  if (jszipPromise) return jszipPromise;

  jszipPromise = (async () => {
    for (const url of JSZIP_CDNS) {
      try {
        log(`Carregando JSZip de ${new URL(url).hostname}...`);
        await loadScript(url);
        if (typeof window.JSZip !== "undefined") {
          log("JSZip carregado.");
          return window.JSZip;
        }
      } catch (err) {
        log(`JSZip indisponível em ${new URL(url).hostname}.`);
      }
    }
    jszipPromise = null;
    throw new Error("Não foi possível carregar o JSZip em nenhum CDN.");
  })();

  return jszipPromise;
}

// "Baixar todos": junta todos os repositórios em UM único arquivo .zip.
async function backupAllAsSingleZip(list) {
  if (!list.length) return;

  let JSZipCtor;
  try {
    JSZipCtor = await ensureJSZip();
  } catch (err) {
    log(`${err.message} Baixando os repositórios separadamente...`);
    return backupRepos(list);
  }

  const toDrive = ui.driveToggle.checked;
  ui.downloadAllBtn.disabled = true;
  log(`Gerando zip único com ${list.length} repositório(s)${toDrive ? " + Drive" : ""}...`);

  const bundle = new JSZipCtor();
  let added = 0;

  for (const repo of list) {
    try {
      log(`Baixando ${repo.fullName}...`);
      const { blob, fileName } = await fetchRepoZip(repo);
      bundle.file(fileName, blob);
      added += 1;
      log(`Adicionado ao pacote: ${fileName} (${(blob.size / 1048576).toFixed(2)} MB)`);
    } catch (err) {
      log(`Erro em ${repo.fullName}: ${err.message}`);
    }
  }

  if (!added) {
    log("Nenhum repositório pôde ser baixado; zip não gerado.");
    ui.downloadAllBtn.disabled = repos.length === 0;
    return;
  }

  try {
    log("Compactando pacote final...");
    const stamp = new Date().toISOString().slice(0, 10);
    const bundleName = `repovault-backup-${stamp}.zip`;
    const bundleBlob = await bundle.generateAsync({ type: "blob" });
    saveBlob(bundleBlob, bundleName);
    log(`OK: ${bundleName} (${(bundleBlob.size / 1048576).toFixed(2)} MB, ${added} repositório(s))`);
    if (toDrive) {
      const uploaded = await uploadToDrive(bundleName, bundleBlob);
      log(`Enviado ao Drive: ${uploaded.name}`);
    }
  } catch (err) {
    log(`Erro ao gerar o zip único: ${err.message}`);
  }

  log("Backup concluído.");
  ui.downloadAllBtn.disabled = repos.length === 0;
}

ui.downloadAllBtn.addEventListener("click", () => backupAllAsSingleZip(repos));
