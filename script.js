const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrYtRnqfnh368Vu0IIHCejCJEajnNRBWyjKbhaPmHU-ThXezgcavZScYceiYwJyUA2AFxhzwIUVmbX/pub?gid=519244513&single=true&output=csv";

const RELATO_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScJQAMYqQyQ-OLrIe4J4inkWuPl565zH_fX_lnmLi92R0V3zw/viewform?usp=dialog";

const form = document.getElementById("consultaForm");
const nomeInput = document.getElementById("nome");
const cnsInput = document.getElementById("cns");
const statusBox = document.getElementById("status");
const consultarBtn = document.getElementById("consultarBtn");
const relatoLink = document.getElementById("relatoLink");
const relatoAviso = document.getElementById("relatoAviso");

let registros = [];

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function limparCNS(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function csvToObjects(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] ? values[index].trim() : "";
    });

    return obj;
  });
}

function tokenScore(nomeDigitado, nomeBase) {
  const tokensDigitados = normalizarTexto(nomeDigitado)
    .split(" ")
    .filter((t) => t.length >= 2);

  const baseNormalizada = normalizarTexto(nomeBase);

  if (!tokensDigitados.length) return 0;

  let encontrados = 0;

  for (const token of tokensDigitados) {
    if (baseNormalizada.includes(token)) {
      encontrados++;
    }
  }

  return encontrados / tokensDigitados.length;
}

function levenshtein(a, b) {
  const s = normalizarTexto(a);
  const t = normalizarTexto(b);

  const rows = s.length + 1;
  const cols = t.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s.length][t.length];
}

function nomesSaoCompativeis(nomeDigitado, nomeBase) {
  const nome1 = normalizarTexto(nomeDigitado);
  const nome2 = normalizarTexto(nomeBase);

  if (!nome1 || !nome2) return false;
  if (nome1 === nome2) return true;
  if (nome2.includes(nome1) || nome1.includes(nome2)) return true;

  const score = tokenScore(nome1, nome2);
  if (score >= 0.6) return true;

  const distancia = levenshtein(nome1, nome2);
  const tamanhoMaximo = Math.max(nome1.length, nome2.length);
  const similaridade = 1 - distancia / tamanhoMaximo;

  return similaridade >= 0.72;
}

function setStatus(message, type = "muted") {
  statusBox.className = `status ${type}`;
  statusBox.textContent = message;
}

function configurarLinkDeRelato() {
  const urlValida =
    RELATO_FORM_URL &&
    !RELATO_FORM_URL.includes("SEU_LINK") &&
    !RELATO_FORM_URL.includes("docs.google.com/forms/d/e/SEU_FORM");

  if (urlValida) {
    relatoLink.href = RELATO_FORM_URL;
    relatoLink.setAttribute("aria-disabled", "false");
    relatoLink.classList.remove("is-disabled");
    relatoAviso.textContent =
      "O formulário será aberto em uma nova aba. Caso o Google Forms solicite, basta entrar com a conta Google para enviar o relato.";
    return;
  }

  relatoLink.href = "#";
  relatoLink.setAttribute("aria-disabled", "true");
  relatoLink.classList.add("is-disabled");
}

async function carregarDados() {
  const response = await fetch(CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Não foi possível carregar a base de dados.");
  }

  const csvText = await response.text();
  const rows = csvToObjects(csvText);

  registros = rows.map((row) => ({
    id: row.id || "",
    nome_paciente: row.nome_paciente || "",
    cns_limpo: limparCNS(row.cns_limpo || ""),
    nome_normalizado: normalizarTexto(row.nome_normalizado || row.nome_paciente || ""),
    ativo: normalizarTexto(row.ativo || "")
  }));
}

function consultarPendencia(nome, cns) {
  const nomeNormalizado = normalizarTexto(nome);
  const cnsLimpo = limparCNS(cns);

  return registros.some((registro) => {
    const ativo = registro.ativo === "sim";
    const cnsConfere = registro.cns_limpo === cnsLimpo;
    const nomeConfere = nomesSaoCompativeis(nomeNormalizado, registro.nome_normalizado);

    return ativo && cnsConfere && nomeConfere;
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nome = nomeInput.value.trim();
  const cns = cnsInput.value.trim();

  if (!nome || !cns) {
    setStatus("Preencha nome e CNS para realizar a consulta.", "error");
    return;
  }

  consultarBtn.disabled = true;
  setStatus("Consultando dados, aguarde...", "muted");

  try {
    if (!registros.length) {
      await carregarDados();
    }

    const encontrou = consultarPendencia(nome, cns);

    if (encontrou) {
      setStatus(
        "Encontramos uma pendência cadastral/administrativa na Regulação. Procure o setor para orientações.",
        "success"
      );
    } else {
      setStatus(
        "Nenhuma pendência foi localizada com os dados informados. Em caso de dúvida, procure presencialmente a Regulação de Saúde.",
        "error"
      );
    }
  } catch (error) {
    console.error(error);
    setStatus(
      "Não foi possível realizar a consulta neste momento. Tente novamente em instantes.",
      "error"
    );
  } finally {
    consultarBtn.disabled = false;
  }
});

window.addEventListener("load", async () => {
  configurarLinkDeRelato();

  try {
    await carregarDados();
    setStatus("Base carregada com sucesso. Você já pode realizar a consulta.", "muted");
  } catch (error) {
    console.error(error);
    setStatus(
      "Não foi possível carregar a base de consulta no momento. Verifique a publicação da planilha.",
      "error"
    );
  }
});
