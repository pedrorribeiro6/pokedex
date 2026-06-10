const generationSelect = document.getElementById("generationSelect");
const typePrimarySelect = document.getElementById("typePrimarySelect");
const typeSecondarySelect = document.getElementById("typeSecondarySelect");
const sortSelect = document.getElementById("sortSelect");
const searchInput = document.getElementById("searchInput");
const themeToggleButton = document.getElementById("themeToggleButton");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const pokemonGrid = document.getElementById("pokemonGrid");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");
const loadedCount = document.getElementById("loadedCount");
const statusText = document.getElementById("statusText");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalBody = document.getElementById("modalBody");
const closeModalButton = document.getElementById("closeModalButton");

const API_BASE = "https://pokeapi.co/api/v2";
const generationCache = new Map();
const pokemonCache = new Map();
const allGenerationData = new Map();
let activeDetailAbort = null;

const typeColors = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
  stellar: "#7A7AFF",
  unknown: "#8795A1",
};

const typeDisplayNames = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Venenoso",
  ground: "Terrestre",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Noturno",
  steel: "Aço",
  fairy: "Fada",
  stellar: "Estelar",
  unknown: "Desconhecido",
};

const generationIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const pokemonTypeNames = Object.keys(typeColors);
const themeStorageKey = "pokedex-theme";

const state = {
  generation: "all",
  primaryType: "",
  secondaryType: "",
  sortBy: "id",
  search: "",
  isReady: false,
};

function formatNumber(value) {
  return String(value).padStart(3, "0");
}

function formatLabel(value) {
  return value
    .toString()
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTypeLabel(typeName) {
  return typeDisplayNames[typeName] ?? formatLabel(typeName);
}

function formatStat(value, unit = "") {
  const normalized = value / 10;
  const rounded = Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1);
  return `${rounded}${unit}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function getPreferredTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleButton.dataset.theme = theme;
  themeToggleButton.querySelector(".theme-toggle__label").textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
  themeToggleButton.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggleButton.setAttribute("aria-label", theme === "dark" ? "Alternar para tema claro" : "Alternar para tema escuro");
  localStorage.setItem(themeStorageKey, theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function populateTypeSelect(selectElement, placeholderText) {
  selectElement.innerHTML = [
    `<option value="">${placeholderText}</option>`,
    ...pokemonTypeNames.map((typeName) => `<option value="${typeName}">${formatTypeLabel(typeName)}</option>`),
  ].join("");
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}`);
  }

  return response.json();
}

async function loadGeneration(genId) {
  if (generationCache.has(genId)) {
    return generationCache.get(genId);
  }

  const request = (async () => {
    const payload = await fetchJson(`${API_BASE}/generation/${genId}`);
    const species = payload.pokemon_species
      .map((item) => ({
        id: Number(item.url.split("/").filter(Boolean).at(-1)),
        name: item.name,
        url: item.url,
        generation: genId,
      }))
      .sort((a, b) => a.id - b.id);

    allGenerationData.set(genId, species);
    loadedCount.textContent = String([...allGenerationData.values()].reduce((total, items) => total + items.length, 0));
    return species;
  })();

  generationCache.set(genId, request);
  return request;
}

async function loadAllGenerations() {
  setStatus("Carregando gerações...");
  await Promise.all(generationIds.map((genId) => loadGeneration(genId)));
  setStatus("Dados prontos");
  state.isReady = true;
}

function getAvailablePokemon() {
  if (state.generation === "all") {
    return [...allGenerationData.values()].flat();
  }

  return allGenerationData.get(Number(state.generation)) ?? [];
}

function getSelectedTypes() {
  return [state.primaryType, state.secondaryType].filter((typeName, index, array) => typeName && array.indexOf(typeName) === index);
}

function filterBySelectedTypes(items) {
  const selectedTypes = getSelectedTypes();
  if (!selectedTypes.length) {
    return items;
  }

  return items.filter((pokemon) => selectedTypes.every((typeName) => pokemon.types.includes(typeName)));
}

function applySearchAndSort(items) {
  const filtered = items.filter((item) => item.name.includes(state.search));

  return filtered.sort((left, right) => {
    if (state.sortBy === "name") {
      return left.name.localeCompare(right.name);
    }

    if (state.sortBy === "height") {
      return (left.height ?? Number.POSITIVE_INFINITY) - (right.height ?? Number.POSITIVE_INFINITY);
    }

    if (state.sortBy === "weight") {
      return (left.weight ?? Number.POSITIVE_INFINITY) - (right.weight ?? Number.POSITIVE_INFINITY);
    }

    return (left.id ?? Number.POSITIVE_INFINITY) - (right.id ?? Number.POSITIVE_INFINITY);
  });
}

async function enrichPokemonList(items) {
  return Promise.all(items.map((item) => getPokemonDetails(item.name, item.generation)));
}

function sortDetailedPokemon(items) {
  return [...items].sort((left, right) => {
    if (state.sortBy === "name") {
      return left.name.localeCompare(right.name);
    }

    if (state.sortBy === "height") {
      return left.height - right.height;
    }

    if (state.sortBy === "weight") {
      return left.weight - right.weight;
    }

    return left.id - right.id;
  });
}

function renderLoading(count = 8) {
  pokemonGrid.innerHTML = Array.from({ length: count })
    .map(
      () => `
        <article class="card" aria-hidden="true">
          <div class="card__header">
            <div>
              <span class="card__number">#---</span>
              <h3 class="card__name">Carregando...</h3>
            </div>
          </div>
          <div class="card__image-wrap"></div>
          <div class="type-list">
            <span class="type-pill">...</span>
          </div>
          <div class="card__meta">
            <div><span>Altura</span><strong>--</strong></div>
            <div><span>Peso</span><strong>--</strong></div>
          </div>
        </article>
      `,
    )
    .join("");
}

async function getPokemonDetails(name, generation) {
  const cacheKey = `${generation}:${name}`;
  if (pokemonCache.has(cacheKey)) {
    return pokemonCache.get(cacheKey);
  }

  const promise = (async () => {
    const species = await fetchJson(`${API_BASE}/pokemon-species/${name}`);
    const pokemonUrl = species.varieties.find((variety) => variety.is_default)?.pokemon.url ?? `${API_BASE}/pokemon/${name}`;
    const data = await fetchJson(pokemonUrl);
    const flavorTextEntry = species.flavor_text_entries.find((entry) => entry.language.name === "en") ??
      species.flavor_text_entries.find((entry) => entry.language.name === "pt-br") ??
      species.flavor_text_entries[0];

    return {
      id: data.id,
      name: data.name,
      generation,
      height: data.height,
      weight: data.weight,
      types: data.types.map((entry) => entry.type.name),
      abilities: data.abilities.map((entry) => entry.ability.name),
      image:
        data.sprites.other?.["official-artwork"]?.front_default ??
        data.sprites.other?.dream_world?.front_default ??
        data.sprites.front_default,
      stats: data.stats.map((stat) => ({
        name: stat.stat.name,
        value: stat.base_stat,
      })),
      description: flavorTextEntry ? flavorTextEntry.flavor_text.replace(/\f/g, " ").replace(/\s+/g, " ") : "Sem descrição disponível.",
    };
  })();

  pokemonCache.set(cacheKey, promise);
  return promise;
}

function createTypePill(typeName) {
  const color = typeColors[typeName] ?? "#FFFFFF";
  return `<span class="type-pill" style="background:${color};">${formatTypeLabel(typeName)}</span>`;
}

function renderCard(pokemon) {
  const accent = typeColors[pokemon.types[0]] ?? "#FFFFFF";

  return `
    <article class="card" data-name="${pokemon.name}" data-generation="${pokemon.generation}" style="border-color: ${accent}22;">
      <div class="card__header">
        <div>
          <span class="card__number">#${formatNumber(pokemon.id)}</span>
          <h3 class="card__name">${pokemon.name}</h3>
        </div>
      </div>
      <div class="card__image-wrap">
        <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy" />
      </div>
      <div class="type-list">${pokemon.types.map(createTypePill).join("")}</div>
      <div class="card__meta">
        <div><span>Altura</span><strong>${formatStat(pokemon.height, " m")}</strong></div>
        <div><span>Peso</span><strong>${formatStat(pokemon.weight, " kg")}</strong></div>
      </div>
    </article>
  `;
}

function renderResults(pokemonList) {
  if (!pokemonList.length) {
    pokemonGrid.innerHTML = "";
    emptyState.classList.remove("is-hidden");
    return;
  }

  emptyState.classList.add("is-hidden");
  pokemonGrid.innerHTML = pokemonList.map(renderCard).join("");
}

async function updateView() {
  if (!state.isReady) {
    return;
  }

  loadingState.classList.add("is-hidden");
  const rawItems = getAvailablePokemon();
  const filteredItems = applySearchAndSort(rawItems);
  const selectedTypes = getSelectedTypes();
  const shouldUseDetails = selectedTypes.length > 0 || state.sortBy === "height" || state.sortBy === "weight";

  if (!filteredItems.length) {
    resultCount.textContent = "0";
    renderResults([]);
    return;
  }

  try {
    setStatus(selectedTypes.length ? "Filtrando por tipagem..." : "Carregando resultados...");
    if (shouldUseDetails) {
      renderLoading(Math.min(filteredItems.length, 8));
    }

    const itemsToRender = shouldUseDetails ? await enrichPokemonList(filteredItems) : filteredItems;
    const typeFilteredItems = filterBySelectedTypes(itemsToRender);
    resultCount.textContent = String(typeFilteredItems.length);

    if (!typeFilteredItems.length) {
      renderResults([]);
      setStatus("Nenhum Pokémon encontrado");
      return;
    }

    const sortedItems = shouldUseDetails ? sortDetailedPokemon(typeFilteredItems) : typeFilteredItems;
    const visibleItems = sortedItems;
    const detailedVisibleItems = shouldUseDetails ? visibleItems : await enrichPokemonList(visibleItems);

    renderResults(sortDetailedPokemon(detailedVisibleItems));
    setStatus(`${typeFilteredItems.length} Pokémon encontrados`);
  } catch (error) {
    pokemonGrid.innerHTML = "";
    emptyState.textContent = "Não foi possível carregar os dados da PokéAPI agora.";
    emptyState.classList.remove("is-hidden");
    setStatus("Erro ao carregar dados");
    console.error(error);
  }
}

async function openModal(pokemonName, generation) {
  if (activeDetailAbort) {
    activeDetailAbort.abort();
  }

  activeDetailAbort = new AbortController();
  modalBody.innerHTML = `<div class="state-panel">Carregando detalhes...</div>`;
  modalBackdrop.classList.remove("is-hidden");
  modalBackdrop.setAttribute("aria-hidden", "false");

  try {
    const data = await getPokemonDetails(pokemonName, generation);
    if (activeDetailAbort.signal.aborted) {
      return;
    }

    modalBody.innerHTML = `
      <div class="modal-layout">
        <div class="modal-visual" style="background: linear-gradient(180deg, ${typeColors[data.types[0]] ?? "#ffffff"}33, rgba(255,255,255,0.03));">
          <img src="${data.image}" alt="${data.name}" />
        </div>
        <div>
          <h2 id="modalTitle">${data.name}</h2>
          <p class="modal__subline">#${formatNumber(data.id)} · Geração ${data.generation}</p>
          <div class="modal-types">${data.types.map(createTypePill).join("")}</div>
          <p class="modal-description">${data.description}</p>
          <div class="modal-stats">
            <div class="stat"><span>Altura</span><strong>${formatStat(data.height, " m")}</strong></div>
            <div class="stat"><span>Peso</span><strong>${formatStat(data.weight, " kg")}</strong></div>
            <div class="stat"><span>Habilidades</span><strong>${data.abilities.map(formatLabel).join(", ")}</strong></div>
            <div class="stat"><span>Tipos</span><strong>${data.types.map(formatTypeLabel).join(", ")}</strong></div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    modalBody.innerHTML = `<div class="state-panel">Não foi possível carregar os detalhes.</div>`;
    console.error(error);
  }
}

function closeModal() {
  modalBackdrop.classList.add("is-hidden");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function attachListeners() {
  themeToggleButton.addEventListener("click", toggleTheme);

  typePrimarySelect.addEventListener("change", (event) => {
    state.primaryType = event.target.value;
    updateView();
  });

  typeSecondarySelect.addEventListener("change", (event) => {
    state.secondaryType = event.target.value;
    updateView();
  });

  generationSelect.addEventListener("change", (event) => {
    state.generation = event.target.value;
    updateView();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    updateView();
  });

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    updateView();
  });

  clearFiltersButton.addEventListener("click", () => {
    state.generation = "all";
    state.primaryType = "";
    state.secondaryType = "";
    state.sortBy = "id";
    state.search = "";
    generationSelect.value = "all";
    typePrimarySelect.value = "";
    typeSecondarySelect.value = "";
    sortSelect.value = "id";
    searchInput.value = "";
    updateView();
  });

  pokemonGrid.addEventListener("click", async (event) => {
    const card = event.target.closest(".card");
    if (!card) {
      return;
    }

    await openModal(card.dataset.name, Number(card.dataset.generation));
  });

  closeModalButton.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

async function init() {
  applyTheme(getPreferredTheme());
  renderLoading();
  populateTypeSelect(typePrimarySelect, "Todas");
  populateTypeSelect(typeSecondarySelect, "Todas");
  attachListeners();

  try {
    await loadAllGenerations();
    loadingState.classList.add("is-hidden");
    await updateView();
  } catch (error) {
    loadingState.textContent = "Não foi possível carregar a Pokédex. Verifique sua conexão com a internet.";
    setStatus("Falha no carregamento");
    console.error(error);
  }
}

init();
