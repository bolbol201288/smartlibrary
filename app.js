const STORAGE_KEY = "smart-library.books.v1";

const elements = {
  form: document.querySelector("#book-form"),
  title: document.querySelector("#title"),
  author: document.querySelector("#author"),
  category: document.querySelector("#category"),
  isbn: document.querySelector("#isbn"),
  search: document.querySelector("#search"),
  statusFilter: document.querySelector("#status-filter"),
  categoryFilter: document.querySelector("#category-filter"),
  sortOrder: document.querySelector("#sort-order"),
  bookList: document.querySelector("#book-list"),
  resultCount: document.querySelector("#result-count"),
  totalCount: document.querySelector("#total-count"),
  availableCount: document.querySelector("#available-count"),
  borrowedCount: document.querySelector("#borrowed-count"),
  message: document.querySelector("#app-message")
};

let books = [];
let storageReady = false;

function showMessage(message, isError) {
  elements.message.textContent = message;
  elements.message.classList.toggle("message-error", Boolean(isError));
  elements.message.hidden = !message;
}

function normalizeText(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeIsbn(value) {
  return String(value).replace(/[\s-]/g, "").toUpperCase();
}

function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);

  if (!isbn) {
    return true;
  }

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = Array.from(isbn).reduce((total, character, index) => {
      const digit = character === "X" ? 10 : Number(character);
      return total + digit * (10 - index);
    }, 0);
    return sum % 11 === 0;
  }

  if (/^\d{13}$/.test(isbn)) {
    const sum = Array.from(isbn).reduce((total, character, index) => {
      return total + Number(character) * (index % 2 === 0 ? 1 : 3);
    }, 0);
    return sum % 10 === 0;
  }

  return false;
}

function isBookRecord(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.id.trim() &&
    typeof value.title === "string" &&
    value.title.trim() &&
    typeof value.author === "string" &&
    value.author.trim() &&
    typeof value.category === "string" &&
    value.category.trim() &&
    typeof value.isbn === "string" &&
    typeof value.addedAt === "string" &&
    Number.isFinite(Date.parse(value.addedAt)) &&
    (value.status === "DISPONIBLE" || value.status === "EMPRUNTE")
  );
}

function loadBooks() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) {
      books = [];
      storageReady = true;
      return;
    }

    const parsedBooks = JSON.parse(storedValue);
    const ids = new Set();
    const isValidCollection = Array.isArray(parsedBooks) && parsedBooks.every((book) => {
      if (!isBookRecord(book) || ids.has(book.id)) {
        return false;
      }

      ids.add(book.id);
      return true;
    });

    if (!isValidCollection) {
      throw new Error("La collection enregistrée n’a pas le format attendu.");
    }

    books = parsedBooks;
    storageReady = true;
  } catch (error) {
    books = [];
    storageReady = false;
    showMessage(
      "Impossible de charger la collection enregistrée. Les modifications sont désactivées pour protéger vos données.",
      true
    );
  }
}

function saveBooks(nextBooks) {
  if (!storageReady) {
    showMessage("La collection n’est pas disponible ; aucune modification n’a été enregistrée.", true);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBooks));
    books = nextBooks;
    return true;
  } catch (error) {
    showMessage("Impossible d’enregistrer les modifications dans ce navigateur.", true);
    return false;
  }
}

function createBookId() {
  let id;

  do {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      id = globalThis.crypto.randomUUID();
    } else {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  } while (books.some((book) => book.id === id));

  return id;
}

function compareText(first, second) {
  return first.localeCompare(second, "fr", { sensitivity: "base" });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function renderCategoryOptions() {
  const selectedCategory = elements.categoryFilter.value;
  const categoriesByKey = new Map();

  books.forEach((book) => {
    const key = normalizeText(book.category);
    if (!categoriesByKey.has(key)) {
      categoriesByKey.set(key, book.category);
    }
  });

  elements.categoryFilter.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Toutes les catégories";
  elements.categoryFilter.append(allOption);

  Array.from(categoriesByKey.entries())
    .sort((first, second) => compareText(first[1], second[1]))
    .forEach(([key, category]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = category;
      elements.categoryFilter.append(option);
    });

  if (categoriesByKey.has(selectedCategory)) {
    elements.categoryFilter.value = selectedCategory;
  }
}

function getVisibleBooks() {
  const searchTerm = normalizeText(elements.search.value);
  const status = elements.statusFilter.value;
  const category = elements.categoryFilter.value;

  return books
    .filter((book) => {
      const matchesSearch = !searchTerm ||
        normalizeText(book.title).includes(searchTerm) ||
        normalizeText(book.author).includes(searchTerm);
      const matchesStatus = !status || book.status === status;
      const matchesCategory = !category || normalizeText(book.category) === category;

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((first, second) => {
      switch (elements.sortOrder.value) {
        case "oldest":
          return first.addedAt.localeCompare(second.addedAt) || compareText(first.title, second.title);
        case "title":
          return compareText(first.title, second.title) || compareText(first.author, second.author);
        case "author":
          return compareText(first.author, second.author) || compareText(first.title, second.title);
        case "newest":
        default:
          return second.addedAt.localeCompare(first.addedAt) || compareText(first.title, second.title);
      }
    });
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createMetadataLine(label, value) {
  const line = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  labelElement.textContent = `${label} : `;
  valueElement.textContent = value;
  line.append(labelElement, valueElement);

  return line;
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card";

  const top = document.createElement("div");
  top.className = "book-card-top";
  top.append(
    createTextElement("span", "category-tag", book.category),
    createTextElement(
      "span",
      `status-badge ${book.status === "DISPONIBLE" ? "status-available" : "status-borrowed"}`,
      book.status === "DISPONIBLE" ? "DISPONIBLE" : "EMPRUNTÉ"
    )
  );

  const title = createTextElement("h3", "book-title", book.title);
  const author = createTextElement("p", "book-author", `par ${book.author}`);

  const metadata = document.createElement("div");
  metadata.className = "book-meta";
  if (book.isbn) {
    metadata.append(createMetadataLine("ISBN", book.isbn));
  }
  metadata.append(createMetadataLine("Ajouté le", formatDate(book.addedAt)));

  const actions = document.createElement("div");
  actions.className = "book-actions";

  const statusButton = document.createElement("button");
  statusButton.type = "button";
  statusButton.className = "button button-small button-status";
  statusButton.dataset.action = "toggle-status";
  statusButton.dataset.bookId = book.id;
  statusButton.textContent = book.status === "DISPONIBLE" ? "Emprunter" : "Retourner";
  statusButton.setAttribute(
    "aria-label",
    `${statusButton.textContent} le livre ${book.title}`
  );

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "button button-small button-delete";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.bookId = book.id;
  deleteButton.textContent = "Supprimer";
  deleteButton.setAttribute("aria-label", `Supprimer le livre ${book.title}`);

  actions.append(statusButton, deleteButton);
  card.append(top, title, author, metadata, actions);

  return card;
}

function renderEmptyState(title, description, variant) {
  const emptyState = document.createElement("div");
  emptyState.className = `empty-state empty-state-${variant}`;

  const iconText = variant === "welcome" ? "＋" : variant === "unavailable" ? "!" : "";
  const icon = createTextElement(
    "span",
    `empty-icon${variant === "no-results" ? " empty-icon-search" : ""}`,
    iconText
  );
  icon.setAttribute("aria-hidden", "true");
  emptyState.append(icon, createTextElement("h3", "", title), createTextElement("p", "", description));

  if (variant === "no-results") {
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "button button-small button-reset";
    resetButton.textContent = "Effacer la recherche et les filtres";
    resetButton.addEventListener("click", () => {
      elements.search.value = "";
      elements.statusFilter.value = "";
      elements.categoryFilter.value = "";
      render();
    });
    emptyState.append(resetButton);
  }

  elements.bookList.append(emptyState);
}

function render() {
  renderCategoryOptions();

  const availableBooks = books.filter((book) => book.status === "DISPONIBLE").length;
  const borrowedBooks = books.length - availableBooks;
  elements.totalCount.textContent = storageReady ? String(books.length) : "—";
  elements.availableCount.textContent = storageReady ? String(availableBooks) : "—";
  elements.borrowedCount.textContent = storageReady ? String(borrowedBooks) : "—";
  elements.form.querySelector("button[type='submit']").disabled = !storageReady;
  elements.bookList.replaceChildren();

  if (!storageReady) {
    elements.resultCount.textContent = "Collection indisponible";
    renderEmptyState(
      "Collection non chargée",
      "Rechargez la page après avoir vérifié l’accès au stockage local.",
      "unavailable"
    );
    return;
  }

  const visibleBooks = getVisibleBooks();
  elements.resultCount.textContent =
    `${visibleBooks.length} livre${visibleBooks.length > 1 ? "s" : ""} affiché${visibleBooks.length > 1 ? "s" : ""}`;

  if (books.length === 0) {
    renderEmptyState(
      "Bienvenue dans votre bibliothèque",
      "Votre collection est vide pour le moment. Ajoutez votre premier livre avec le formulaire.",
      "welcome"
    );
    return;
  }

  if (visibleBooks.length === 0) {
    renderEmptyState(
      "Aucun livre ne correspond à votre recherche",
      "Modifiez vos termes ou vos filtres, ou réinitialisez-les pour revoir toute la collection.",
      "no-results"
    );
    return;
  }

  visibleBooks.forEach((book) => elements.bookList.append(createBookCard(book)));
}

function onAddBook(event) {
  event.preventDefault();

  if (!storageReady) {
    showMessage("La collection n’est pas disponible ; le livre n’a pas été ajouté.", true);
    return;
  }

  const title = elements.title.value.trim();
  const author = elements.author.value.trim();
  const category = elements.category.value.trim();
  const isbn = elements.isbn.value.trim();

  if (!title || !author || !category) {
    showMessage("Le titre, l’auteur et la catégorie sont obligatoires.", true);
    return;
  }

  if (!isValidIsbn(isbn)) {
    showMessage("L’ISBN doit être un ISBN-10 ou ISBN-13 valide.", true);
    elements.isbn.focus();
    return;
  }

  const normalizedIsbn = normalizeIsbn(isbn);
  if (normalizedIsbn && books.some((book) => normalizeIsbn(book.isbn) === normalizedIsbn)) {
    showMessage("Un livre avec cet ISBN existe déjà dans la collection.", true);
    elements.isbn.focus();
    return;
  }

  const newBook = {
    id: createBookId(),
    title,
    author,
    isbn,
    category,
    addedAt: new Date().toISOString(),
    status: "DISPONIBLE"
  };

  if (saveBooks([...books, newBook])) {
    elements.form.reset();
    showMessage(`« ${title} » a été ajouté à la bibliothèque.`);
    render();
  }
}

function onBookListClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button || !storageReady) {
    return;
  }

  const book = books.find((item) => item.id === button.dataset.bookId);
  if (!book) {
    showMessage("Ce livre n’est plus présent dans la collection. Actualisez l’affichage.", true);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!window.confirm(`Supprimer « ${book.title} » de la bibliothèque ?`)) {
      return;
    }

    if (saveBooks(books.filter((item) => item.id !== book.id))) {
      showMessage(`« ${book.title} » a été supprimé.`);
      render();
    }
    return;
  }

  if (button.dataset.action === "toggle-status") {
    const nextStatus = book.status === "DISPONIBLE" ? "EMPRUNTE" : "DISPONIBLE";
    const updatedBooks = books.map((item) =>
      item.id === book.id ? { ...item, status: nextStatus } : item
    );

    if (saveBooks(updatedBooks)) {
      showMessage(
        nextStatus === "EMPRUNTE"
          ? `« ${book.title} » est maintenant emprunté.`
          : `« ${book.title} » est de nouveau disponible.`
      );
      render();
    }
  }
}

function initialize() {
  loadBooks();
  elements.form.addEventListener("submit", onAddBook);
  elements.bookList.addEventListener("click", onBookListClick);
  elements.search.addEventListener("input", render);
  elements.statusFilter.addEventListener("change", render);
  elements.categoryFilter.addEventListener("change", render);
  elements.sortOrder.addEventListener("change", render);
  render();
}

initialize();