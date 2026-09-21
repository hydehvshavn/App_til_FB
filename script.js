import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, OAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
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
  firebase = { auth: getAuth(app), database: getFirestore(app), storage: getStorage(app) };
  onAuthStateChanged(firebase.auth, handleAuthChange);
} else {
  elements.status.textContent = "Demotilstand - gemmes lokalt";
  elements.login.classList.add("hidden");
}

document.querySelector("#newSuggestionButton").addEventListener("click", () => elements.dialog.showModal());
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
  const provider = new OAuthProvider("microsoft.com");
  try { await signInWithPopup(firebase.auth, provider); } catch (error) { elements.status.textContent = "Login kunne ikke gennemføres"; console.error(error); }
}

async function handleAuthChange(user) {
  if (user && user.email?.toLowerCase() !== allowedEmail.toLowerCase()) {
    await signOut(firebase.auth); elements.status.textContent = "Denne konto har ikke adgang"; return;
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
  const formData = new FormData(elements.form);
  const suggestion = { title: formData.get("title").trim(), text: formData.get("text").trim(), archived: false, createdAt: new Date().toISOString() };
  try {
    const image = formData.get("image");
    if (image?.size) {
      if (!firebase) suggestion.imageUrl = URL.createObjectURL(image);
      else { const imageRef = ref(firebase.storage, `suggestions/${Date.now()}-${image.name}`); await uploadBytes(imageRef, image); suggestion.imageUrl = await getDownloadURL(imageRef); }
    }
    if (firebase && currentUser) { const saved = await addDoc(collection(firebase.database, "suggestions"), suggestion); suggestion.id = saved.id; }
    else { suggestion.id = crypto.randomUUID(); suggestions.unshift(suggestion); localStorage.setItem("historySuggestions", JSON.stringify(suggestions)); }
    elements.form.reset(); elements.dialog.close(); render();
  } catch (error) { elements.formMessage.textContent = "Forslaget kunne ikke gemmes. Kontrollér Firebase-opsætningen."; console.error(error); }
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
