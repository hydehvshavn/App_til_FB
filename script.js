import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { initializeFirestore, collection, setDoc, getDocs, updateDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { firebaseConfig, allowedEmail } from "./firebase-config.js";

const elements = {
  list: document.querySelector("#suggestionsList"), empty: document.querySelector("#emptyState"), dialog: document.querySelector("#suggestionDialog"),
  form: document.querySelector("#suggestionForm"), formMessage: document.querySelector("#formMessage"), login: document.querySelector("#loginButton"),
  logout: document.querySelector("#logoutButton"), status: document.querySelector("#userStatus"), search: document.querySelector("#searchInput"),
  activeCount: document.querySelector("#activeCount"), archivedCount: document.querySelector("#archivedCount")
};

let suggestions = JSON.parse(localStorage.getItem("historySuggestions") || "[]");
let currentFilter = "active";
let currentUser = null;
let firebase = null;

if (firebaseConfig.apiKey !== "DIN_API_KEY") {
  const app = initializeApp(firebaseConfig);
  firebase = { auth: getAuth(app), database: initializeFirestore(app, { experimentalForceLongPolling: true }), storage: getStorage(app) };
  elements.status.textContent = "Ikke logget ind";
  onAuthStateChanged(firebase.auth, handleAuthChange);
} else {
  elements.status.textContent = "Demotilstand - gemmes lokalt";
  elements.login.classList.add("hidden");
}

document.querySelector("#closeDialogButton").addEventListener("click", () => elements.dialog.close());
document.querySelector("#cancelButton").addEventListener("click", () => elements.dialog.close());
elements.login.addEventListener("click", login);
elements.logout.addEventListener("click", () => signOut(firebase.auth));
elements.form.addEventListener("submit", saveSuggestion);
elements.search.addEventListener("input", render);
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  currentFilter = tab.dataset.filter;
  document.querySelectorAll(".tab").forEach((item) => { item.classList.toggle("is-active", item === tab); item.setAttribute("aria-selected", item === tab ? "true" : "false"); });
  render();
}));

async function login() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(firebase.auth, provider);
  } catch (error) {
    if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) {
      elements.status.textContent = "Åbner Google-login...";
      await signInWithRedirect(firebase.auth, provider);
      return;
    }
    const messages = {
      "auth/operation-not-allowed": "Google-login er ikke aktiveret i Firebase.",
      "auth/unauthorized-domain": "Denne adresse er ikke godkendt i Firebase Authentication.",
      "auth/popup-blocked": "Browseren blokerede login-vinduet.",
        "auth/popup-closed-by-user": "Loginvinduet blev lukket før login var færdigt.",
        "auth/cancelled-popup-request": "Loginvinduet blev afbrudt. Klik på Google-login én gang og gennemfør loginvinduet."
    };
    elements.status.textContent = messages[error.code] || `Login kunne ikke gennemføres (${error.code || "ukendt fejl"})`;
    console.error(error);
  }
}
document.querySelector("#newSuggestionButton").addEventListener("click", () => {
  if (firebase && !currentUser) {
    elements.status.textContent = "Log ind med Google for at tilføje et forslag";
    return;
  }
  elements.dialog.showModal();
});

async function handleAuthChange(user) {
  if (user && user.email?.toLowerCase() !== allowedEmail.toLowerCase()) {
    const signedInEmail = user.email || "ukendt e-mail";
    await signOut(firebase.auth);
    elements.status.textContent = `Kontoen ${signedInEmail} har ikke adgang`;
    return;
  }
  currentUser = user;
  elements.login.classList.toggle("hidden", Boolean(user)); elements.logout.classList.toggle("hidden", !user);
  elements.status.textContent = user ? user.email : "Ikke logget ind";
  if (user) await loadSuggestions();
}

async function loadSuggestions() {
  const snapshot = await getDocs(query(collection(firebase.database, "suggestions"), orderBy("createdAt", "desc")));
  suggestions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); render();
}

async function saveSuggestion(event) {
  event.preventDefault(); elements.formMessage.textContent = "";
  if (firebase && !currentUser) {
    elements.formMessage.textContent = "Log ind med Google, før du gemmer et forslag i Firebase.";
    return;
  }
  elements.formMessage.textContent = "Gemmer forslag...";
  const formData = new FormData(elements.form);
  const suggestion = { title: formData.get("title").trim(), text: formData.get("text").trim(), archived: false, createdAt: new Date().toISOString() };
  try {
    const image = formData.get("image");
    if (image?.size) {
      if (!firebase) suggestion.imageUrl = URL.createObjectURL(image);
        else {
          const imageRef = ref(firebase.storage, `suggestions/${Date.now()}-${image.name}`);
          const uploadRequest = (async () => {
            await uploadBytes(imageRef, image);
            return getDownloadURL(imageRef);
          })();
          const uploadTimeout = new Promise((resolve, reject) => setTimeout(() => reject(Object.assign(new Error("Storage svarer ikke"), { code: "storage-timeout" })), 10000));
          suggestion.imageUrl = await Promise.race([uploadRequest, uploadTimeout]);
        }
    }
    if (firebase && currentUser) {
      const suggestionId = crypto.randomUUID();
      suggestion.id = suggestionId;
      const saveRequest = setDoc(doc(firebase.database, "suggestions", suggestionId), suggestion);
      const timeout = new Promise((resolve, reject) => setTimeout(() => reject(Object.assign(new Error("Firebase svarer ikke"), { code: "unavailable" })), 10000));
      await Promise.race([saveRequest, timeout]);
    }
    else { suggestion.id = crypto.randomUUID(); suggestions.unshift(suggestion); localStorage.setItem("historySuggestions", JSON.stringify(suggestions)); }
    elements.form.reset(); elements.dialog.close(); render();
  } catch (error) {
    const messages = {
      "permission-denied": "Firebase afviste adgangen. Udgiv firestore.rules og storage.rules, og kontrollér at du er logget ind med den tilladte konto.",
      "storage/unauthorized": "Firebase Storage afviste billedet. Udgiv storage.rules.",
        "storage/bucket-not-found": "Firebase Storage er ikke oprettet i Firebase Console.",
        "storage/unknown": "Firebase Storage kunne ikke modtage billedet. Kontrollér Storage og CORS-indstillingerne.",
        "storage-timeout": "Firebase Storage svarer ikke. Kontrollér at Storage er oprettet og prøv igen.",
      "failed-precondition": "Firestore er ikke oprettet eller aktiveret i Firebase Console.",
      "unavailable": "Firebase er midlertidigt utilgængelig. Kontrollér internetforbindelsen."
    };
    if (error.code === "unavailable" && !suggestion.imageUrl) {
      suggestion.id = suggestion.id || crypto.randomUUID();
      suggestions.unshift(suggestion);
      localStorage.setItem("historySuggestions", JSON.stringify(suggestions));
      elements.form.reset();
      elements.dialog.close();
      elements.status.textContent = "Firebase svarer ikke - forslaget er gemt lokalt";
      render();
      return;
    }
    if (error.code?.startsWith("storage/") || error.code === "storage-timeout") {
      document.querySelector("#imageInput").value = "";
    }
    elements.formMessage.textContent = messages[error.code] || `Forslaget kunne ikke gemmes (${error.code || "ukendt fejl"})`;
    console.error(error);
  }
}

async function archiveSuggestion(id) {
  const suggestion = suggestions.find((item) => item.id === id); if (!suggestion) return;
  suggestion.archived = !suggestion.archived;
  if (firebase && currentUser) await updateDoc(doc(firebase.database, "suggestions", id), { archived: suggestion.archived });
  else localStorage.setItem("historySuggestions", JSON.stringify(suggestions));
  render();
}

function render() {
  const searchTerm = elements.search.value.toLowerCase();
  const active = suggestions.filter((item) => !item.archived); const archived = suggestions.filter((item) => item.archived);
  const visible = (currentFilter === "active" ? active : archived).filter((item) => `${item.title} ${item.text}`.toLowerCase().includes(searchTerm));
  elements.activeCount.textContent = active.length; elements.archivedCount.textContent = archived.length; elements.empty.classList.toggle("hidden", visible.length > 0);
  elements.list.innerHTML = visible.map((item) => `<article class="suggestion-card">${item.imageUrl ? `<img class="suggestion-image" src="${item.imageUrl}" alt="">` : ""}<div class="suggestion-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><div class="card-footer"><span class="date">${formatDate(item.createdAt)}</span><button class="archive-button" data-id="${item.id}" type="button">${item.archived ? "Gendan" : "Arkivér"}</button></div></div></article>`).join("");
  elements.list.querySelectorAll(".archive-button").forEach((button) => button.addEventListener("click", () => archiveSuggestion(button.dataset.id)));
}

function escapeHtml(value) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
function formatDate(value) { return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
render();
