# Calendário Corporativo · Gestão e Ciclo 2026

Site interativo, no estilo de uma página de programação anual, com lista vertical de meses.

## Como abrir

**Direto:** dê duplo clique em `index.html`. Funciona offline (dados embutidos em `embedded.js`).

**Servidor local** (recomendado para edição):
```bash
cd site
python3 -m http.server 8080
```
Abra `http://localhost:8080`.

## O que tem

- **Hero** com 3 estatísticas (meses ativos, total de eventos, marcos)
- **Próximos eventos** em cards horizontais
- **Filtro por mês** em pílulas
- **Lista de meses numerados (01, 02, 03...)** — cada mês mostra seus eventos com balão de dia ao lado
- **Modal** de detalhes ao clicar em qualquer evento
- **⚙ Editar programação** — painel completo de edição

## Edição (3 caminhos)

### 1. Pelo site (mais rápido)
Botão **⚙ Editar programação** no hero. Aba **Eventos** (lista), **Adicionar** (formulário), **Importar/Exportar** (planilha).

Suas alterações ficam salvas no navegador (localStorage).

### 2. Pela planilha (`Calendario_2026_Editavel.xlsx`)
Edite no Excel/Sheets, salve como **CSV**, importe no painel.

### 3. Editando `events.json`
Para usuários técnicos. Estrutura:
```json
{
  "events": [
    {
      "id": "ev_001",
      "title": "Nome do evento",
      "start": "2026-01-15",
      "end": "2026-01-20",
      "category": "avaliacao",
      "important": false,
      "notes": ""
    }
  ]
}
```

## Estrutura

```
site/
├── index.html
├── styles.css
├── app.js
├── events.json                       # dados (editável)
├── embedded.js                       # backup dos dados
├── Calendario_2026_Editavel.xlsx    # planilha modelo
└── README.md
```

## Publicação

Hospedagem estática em qualquer serviço: GitHub Pages, Netlify, Vercel, S3. Não tem backend.
