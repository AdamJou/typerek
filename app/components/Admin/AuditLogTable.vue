<template>
  <div class="audit-table panel">
    <table>
      <thead>
        <tr>
          <th>Czas</th>
          <th>Akcja</th>
          <th>Obiekt</th>
          <th>Powod</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="4">Brak logow audytu do wyswietlenia.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.audit-table {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid var(--app-line);
  padding: 13px 12px;
  text-align: left;
}

th {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

td {
  font-size: 14px;
  font-weight: 700;
}
</style>
