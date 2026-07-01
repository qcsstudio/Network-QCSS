const numberFormat = new Intl.NumberFormat("en-IN");

function text(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function renderStack(container, items, emptyLabel) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "stack-item";
    empty.textContent = emptyLabel;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => container.appendChild(item));
}

function renderDashboard(data) {
  document.querySelector("#totalLeads").textContent = numberFormat.format(data.totals.leads);
  document.querySelector("#hotLeads").textContent = numberFormat.format(data.totals.hotLeads);
  document.querySelector("#totalAssessments").textContent = numberFormat.format(data.totals.assessments);
  document.querySelector("#totalEvents").textContent = numberFormat.format(data.totals.events);
  document.querySelector("#lastUpdated").textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "No data";

  const leadRows = document.querySelector("#leadRows");
  leadRows.innerHTML = "";

  if (!data.latestLeads.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5">No leads captured yet. Submit the public form to test the flow.</td>';
    leadRows.appendChild(row);
  } else {
    data.latestLeads.forEach((lead) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${text(lead.name)}</strong><br><span>${text(lead.email)}</span></td>
        <td>${text(lead.interest)}<br><span>${text(lead.pipeline)}</span></td>
        <td><strong>${text(lead.score, "0")}</strong><br><span>${text(lead.priority)}</span></td>
        <td>${text(lead.context?.country)}</td>
        <td>${text(lead.attribution?.source, "Direct")}</td>
      `;
      leadRows.appendChild(row);
    });
  }

  const pipelineItems = Object.entries(data.byPipeline || {})
    .sort((a, b) => b[1] - a[1])
    .map(([pipeline, count]) => {
      const item = document.createElement("div");
      item.className = "stack-item";
      item.innerHTML = `<strong>${pipeline}<span>${count}</span></strong><span>Lead pipeline</span>`;
      return item;
    });
  renderStack(document.querySelector("#pipelineList"), pipelineItems, "No pipeline data yet.");

  const assessmentItems = (data.latestAssessments || []).map((assessment) => {
    const item = document.createElement("div");
    item.className = "stack-item";
    item.innerHTML = `
      <strong>${text(assessment.title || assessment.tool)}<span>${text(assessment.score, "0")}</span></strong>
      <span>${text(assessment.pipeline)} | ${text(assessment.riskLevel)}</span>
    `;
    return item;
  });
  renderStack(document.querySelector("#assessmentList"), assessmentItems, "No assessments completed yet.");

  const eventList = document.querySelector("#adminEvents");
  eventList.innerHTML = "";
  if (!data.latestEvents.length) {
    const item = document.createElement("li");
    item.textContent = "No events yet.";
    eventList.appendChild(item);
  } else {
    data.latestEvents.forEach((event) => {
      const item = document.createElement("li");
      item.textContent = `${new Date(event.createdAt).toLocaleTimeString()} - ${event.name}`;
      eventList.appendChild(item);
    });
  }
}

async function loadDashboard() {
  const response = await fetch("./api/dashboard", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Dashboard API failed");
  renderDashboard(await response.json());
}

document.querySelector("#refreshDashboard").addEventListener("click", () => {
  loadDashboard().catch((error) => {
    console.error(error);
    alert("Could not refresh dashboard. Is the local server running?");
  });
});

loadDashboard().catch((error) => {
  console.error(error);
});
