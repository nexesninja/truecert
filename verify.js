const WORKER_URL = "https://your-worker.workers.dev";

const form = document.getElementById("verify-form");
const idField = document.getElementById("cert-id");
const nameField = document.getElementById("cert-name");
const typeField = document.getElementById("cert-type");
const eventNote = document.getElementById("event-note");
const result = document.getElementById("result");
const button = form.querySelector("button");
const fixedEvent = document.body.dataset.event || "";
const defaultNote = eventNote ? eventNote.textContent : "";

const events = {};

function esc(value) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, ch => map[ch]);
}

async function ask(path) {
  const res = await fetch(WORKER_URL + path);
  return res.json();
}

function cleanId(raw) {
  const id = raw.replace(/\s+/g, "").toUpperCase();
  if (fixedEvent && id && !id.includes("-")) return fixedEvent + "-" + id;
  return id;
}

function codeFor(raw) {
  if (fixedEvent) return fixedEvent;
  const match = /^([A-Z0-9]{2,8})-/.exec(cleanId(raw));
  return match ? match[1] : "";
}

function fillTypes(ev) {
  const keep = typeField.value;
  typeField.innerHTML = "";

  if (!ev || !ev.found) {
    typeField.add(new Option(ev ? "No event uses this code" : "Enter the ID first", ""));
    if (eventNote) eventNote.textContent = ev ? "No event matches this code. Check the start of the ID." : defaultNote;
    return;
  }

  typeField.add(new Option("Choose a type", ""));
  ev.types.forEach(type => typeField.add(new Option(type, type)));
  if ([...typeField.options].some(option => option.value === keep)) typeField.value = keep;
  if (eventNote) eventNote.textContent = ev.event + ", issued by " + ev.org;
}

async function showEvent(code) {
  if (!code) return fillTypes(null);
  if (!(code in events)) {
    try {
      events[code] = await ask("/event?code=" + encodeURIComponent(code));
    } catch {
      return;
    }
  }
  if (code === codeFor(idField.value)) fillTypes(events[code]);
}

function shareUrl(entered) {
  return location.origin + location.pathname + "?" + new URLSearchParams(entered);
}

function linkedinUrl(data, entered) {
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: data.event,
    certId: entered.id,
    certUrl: shareUrl(entered),
  });
  if (data.linkedin_org_id) params.set("organizationId", data.linkedin_org_id);
  else params.set("organizationName", data.org);

  const issued = new Date(data.date);
  if (!isNaN(issued)) {
    params.set("issueYear", issued.getFullYear());
    params.set("issueMonth", issued.getMonth() + 1);
  }
  return "https://www.linkedin.com/profile/add?" + params;
}

function showValid(data, entered) {
  const rows = [
    ["Issued to", entered.name],
    ["Certificate", entered.type],
    ["Event", data.event],
    ["Issued by", data.org],
    ["Date", data.date],
    ["Certificate ID", entered.id],
  ];
  const logo = !fixedEvent && data.logo
    ? `<img class="org-logo" src="/logos/${esc(data.logo)}" alt="">`
    : "";

  result.className = "ok";
  result.innerHTML = `
    ${logo}
    <p class="status">Certificate verified</p>
    <p class="note">The ID, name and type match what ${esc(data.org)} issued. Compare the details below with the certificate you are checking.</p>
    <dl class="record">
      ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}
    </dl>
    <a class="share" href="${esc(linkedinUrl(data, entered))}" target="_blank" rel="noopener">Add to LinkedIn profile</a>`;
}

function showInvalid() {
  result.className = "fail";
  result.innerHTML = `
    <p class="status">No matching certificate</p>
    <div class="note">
      <p>The details you entered do not match a certificate we can confirm. Please check that:</p>
      <ul>
        <li>the ID is copied exactly, including every letter and digit</li>
        <li>the name is spelled as printed (capital letters and extra spaces do not matter)</li>
        <li>the certificate type is the one printed on the certificate</li>
      </ul>
      <p>If all three are correct and it still fails, contact the organisation that issued the certificate.</p>
    </div>`;
}

function showProblem() {
  result.className = "fail";
  result.innerHTML = `
    <p class="status">Verification is unavailable</p>
    <p class="note">The verification service could not be reached. Try again in a moment.</p>`;
}

async function check(entered) {
  button.disabled = true;
  button.textContent = "Checking...";
  try {
    const data = await ask("/?" + new URLSearchParams(entered));
    if (data.error) showProblem();
    else if (data.valid) showValid(data, entered);
    else showInvalid();
  } catch {
    showProblem();
  }
  button.disabled = false;
  button.textContent = "Verify certificate";
  result.scrollIntoView({ block: "nearest" });
}

form.addEventListener("submit", event => {
  event.preventDefault();
  check({ id: cleanId(idField.value), name: nameField.value.trim(), type: typeField.value });
});

if (!fixedEvent) idField.addEventListener("input", () => showEvent(codeFor(idField.value)));
if (fixedEvent) showEvent(fixedEvent);

const params = new URLSearchParams(location.search);
if (params.get("id")) {
  idField.value = cleanId(params.get("id"));
  nameField.value = params.get("name") || "";
  const wanted = (params.get("type") || "").toLowerCase();
  showEvent(codeFor(idField.value)).then(() => {
    const match = [...typeField.options].find(option => option.value.toLowerCase() === wanted);
    if (match) typeField.value = match.value;
    if (nameField.value && typeField.value) {
      check({ id: idField.value, name: nameField.value.trim(), type: typeField.value });
    }
  });
}
