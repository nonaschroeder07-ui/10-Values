// Приложение «Мои 10 ценностей»: интервью по шагам без интернета и без ИИ.
// Содержание (ценности и варианты ответа) — в content.js. Прогресс хранится в localStorage.
(function () {
  "use strict";
  const C = window.CONTENT;
  const THEMES = C.themes;
  const KEY = "values-free-v1";

  // Порядок экранов: вступление → 9 тем (с итогами после 3-й и 6-й) → выбор → смысл → приоритеты → итог
  const STEPS = [{ type: "intro" }];
  THEMES.forEach((t, i) => {
    STEPS.push({ type: "theme", i });
    if (i === 2 || i === 5) STEPS.push({ type: "summary" });
  });
  STEPS.push({ type: "select" }, { type: "details" }, { type: "prio" }, { type: "result" });
  const STEP_OF = (type) => STEPS.findIndex((s) => s.type === type);

  const fresh = () => ({ step: 0, picks: {}, own: {}, rejected: [], chosen: [], custom: {}, info: {}, prio: [], statement: "", stmtEdited: false, customN: 0 });
  let state = load();
  let ui = { hint: false, showAll: false, warn: "" };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && typeof s.step === "number") return Object.assign(fresh(), s);
    } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  // ——— помощники ———
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : String(c)); });
    return el;
  }
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
  const lowerFirst = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const def = (id) => C.values[id] || state.custom[id] || [id, ""];
  const isChosen = (id) => state.chosen.includes(id);
  const isRejected = (id) => state.rejected.includes(id);

  // Подсчёт: какие ценности стоят за отмеченными вариантами и какими словами
  function analyse() {
    const score = {}, ev = {};
    THEMES.forEach((t) => {
      (state.picks[t.id] || []).forEach((idx) => {
        const o = t.options[idx]; if (!o) return;
        o[1].split(" ").forEach((v) => {
          score[v] = (score[v] || 0) + 1;
          (ev[v] = ev[v] || []).push(o[0]);
        });
      });
    });
    return { score, ev };
  }
  const quoteList = (arr, n) => arr.slice(0, n).map((t) => "«" + t + "»").join(", ");

  function ensureInfo(id) {
    if (!state.info[id]) {
      const d = def(id), a = analyse();
      state.info[id] = { name: d[0], meaning: d[1], example: quoteList(a.ev[id] || [], 2), imp: 0 };
    }
    return state.info[id];
  }

  function choose(id) {
    if (isChosen(id)) { state.chosen = state.chosen.filter((x) => x !== id); state.prio = state.prio.filter((x) => x !== id); return true; }
    if (state.chosen.length >= 10) { ui.warn = "Уже выбрано 10. Сними одну ценность, чтобы выбрать другую."; return false; }
    state.chosen.push(id); state.rejected = state.rejected.filter((x) => x !== id); ensureInfo(id);
    return true;
  }

  function goto(n) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, n));
    ui = { hint: false, showAll: false, warn: "" };
    if (STEPS[state.step].type === "prio" && state.prio.length === 0) {
      state.prio = state.chosen.slice().sort((a, b) => (ensureInfo(b).imp - ensureInfo(a).imp)).slice(0, 3);
    }
    save(); render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stepLabel(s) {
    switch (s.type) {
      case "intro": return "Вступление";
      case "theme": return "Тема " + (s.i + 1) + " из " + THEMES.length + " · " + THEMES[s.i].title;
      case "summary": return "Промежуточный итог";
      case "select": return "Выбор десяти";
      case "details": return "Смысл и важность";
      case "prio": return "Приоритеты";
      default: return "Итог";
    }
  }

  // ——— экраны ———
  function nav(opts) {
    return h("div", { class: "nav" },
      state.step > 0 ? h("button", { class: "ghost", type: "button", onclick: () => goto(state.step - 1) }, "Назад") : h("span"),
      h("div", { class: "note", text: opts.note || "" }),
      opts.next === false ? h("span") : h("button", { class: "primary", type: "button", disabled: opts.disabled, onclick: opts.onNext || (() => goto(state.step + 1)) }, opts.label || "Дальше")
    );
  }

  function counter() {
    const n = state.chosen.length;
    const dots = h("div", { class: "dots" });
    for (let i = 0; i < 10; i++) dots.append(h("span", { class: i < n ? "on" : "" }));
    return h("div", { style: "display:grid;gap:8px" },
      h("div", { class: "counter" }, h("b", { text: String(n) }), h("span", { class: "hint-text", text: "из 10 подтверждено" })),
      dots);
  }

  function ownList() {
    const items = THEMES.filter((t) => (state.own[t.id] || "").trim()).map((t) => h("li", null, h("b", { text: t.title + ": " }), state.own[t.id].trim()));
    if (!items.length) return null;
    return h("div", { class: "field" }, h("div", { class: "lbl", text: "Твои собственные слова" }), h("ul", { class: "own" }, items));
  }

  function screenIntro() {
    const started = Object.keys(state.picks).length > 0;
    return [h("section", { class: "card soft" },
      h("div", { class: "q-label", text: "Как это устроено" }),
      h("h1", { class: "q-title" }, "Найди то, на что ты ", h("span", { class: "gold-text", text: "опираешься" }), " в жизни"),
      h("p", { class: "lead", text: "Это спокойный разговор с собой в своём темпе. Здесь нет правильных ответов: отмечай то, что откликается, и пропускай то, что не про тебя." }),
      h("ol", { class: "steps" },
        h("li", null, h("span", { text: "1" }), h("div", { text: "Девять тем: радость, гордость, мечты, решения, то, чем нельзя поступиться, и другие. В каждой — готовые варианты и место для своих слов." })),
        h("li", null, h("span", { text: "2" }), h("div", { text: "Промежуточные итоги: ты увидишь, какие ценности проявляются, и подтвердишь те, что узнаёшь." })),
        h("li", null, h("span", { text: "3" }), h("div", { text: "Отберёшь ровно десять и опишешь своими словами, что каждая значит для тебя." })),
        h("li", null, h("span", { text: "4" }), h("div", { text: "Оценишь их важность сейчас и выберешь три приоритета." })),
        h("li", null, h("span", { text: "5" }), h("div", { text: "Получишь таблицу своих ценностей и описание «Для меня важно…»." }))
      ),
      h("p", { class: "hint-text", text: "Займёт 15–25 минут. Можно прерваться в любой момент — ответы сохранятся на этом устройстве." })
    ), nav({ label: started ? "Продолжить" : "Начать", onNext: () => goto(started ? Math.max(1, firstOpenStep()) : 1) })];
  }
  function firstOpenStep() {
    for (let i = 1; i < STEPS.length; i++) {
      const s = STEPS[i];
      if (s.type === "theme" && !(state.picks[THEMES[s.i].id] || []).length && !(state.own[THEMES[s.i].id] || "").trim()) return i;
    }
    return STEP_OF("select");
  }

  function screenTheme(s) {
    const t = THEMES[s.i];
    const picks = state.picks[t.id] || (state.picks[t.id] = []);
    const grid = h("div", { class: "opts", role: "group", "aria-label": t.question });
    let lastGroup = null;
    t.options.forEach((o, idx) => {
      if (o[2] && o[2] !== lastGroup) { lastGroup = o[2]; grid.append(h("div", { class: "group-title", text: o[2] })); }
      const btn = h("button", { class: "opt", type: "button", "aria-pressed": picks.includes(idx) ? "true" : "false" },
        h("span", { class: "box", "aria-hidden": "true" }), h("span", { text: o[0] }));
      btn.addEventListener("click", () => {
        const at = picks.indexOf(idx);
        if (at >= 0) picks.splice(at, 1); else picks.push(idx);
        btn.setAttribute("aria-pressed", at >= 0 ? "false" : "true");
        updateNote(); save();
      });
      grid.append(btn);
    });
    const hintBox = h("div", { class: "hint", text: t.hint, hidden: !ui.hint });
    const own = h("textarea", { id: "own-" + t.id, placeholder: "Если чего-то не хватает — напиши своими словами." });
    own.value = state.own[t.id] || "";
    own.addEventListener("input", () => { state.own[t.id] = own.value; save(); updateNote(); });
    const n = nav({ note: "", onNext: () => {
      if (!picks.length && !own.value.trim()) { noteEl.textContent = "Отметь хотя бы один вариант или напиши свой."; noteEl.style.display = "block"; return; }
      goto(state.step + 1);
    } });
    const noteEl = n.querySelector(".note");
    function updateNote() {
      noteEl.textContent = picks.length ? "Отмечено: " + picks.length : "";
      noteEl.style.display = "";
    }
    updateNote();
    return [h("section", { class: "card" },
      h("div", { class: "q-label", text: "Тема " + (s.i + 1) + " · " + t.title }),
      h("h1", { class: "q-title", text: t.question }),
      h("p", { class: "lead", text: t.lead }),
      h("div", null, h("button", { class: "linkish", type: "button", "aria-expanded": ui.hint ? "true" : "false", onclick: (e) => { ui.hint = !ui.hint; hintBox.hidden = !ui.hint; e.currentTarget.setAttribute("aria-expanded", String(ui.hint)); } }, "Трудно ответить? Вспомни конкретный момент")),
      hintBox,
      grid,
      h("div", { class: "field" }, h("label", { for: "own-" + t.id, text: "Свой вариант" }), own)
    ), n];
  }

  function valueCard(id, a, mode) {
    const d = def(id), sc = a.score[id] || 0, on = isChosen(id), off = isRejected(id) && !on;
    const card = h("div", { class: "vcard" + (on ? " on" : "") + (off ? " off" : "") },
      h("div", { class: "vname" }, h("span", { text: d[0] }), sc ? h("span", { class: "score", text: sc + " " + plural(sc, "ответ", "ответа", "ответов") }) : null),
      d[1] ? h("p", { class: "vmean", text: "Это когда важно " + d[1] + "." }) : null,
      (a.ev[id] || []).length ? h("p", { class: "vev", text: "Из твоих ответов: " + quoteList(a.ev[id], 3) }) : null
    );
    const act = h("div", { class: "vact" });
    if (mode === "summary") {
      act.append(
        h("button", { class: "pick", type: "button", disabled: state.chosen.length >= 10, onclick: () => { choose(id); save(); render(); } }, "Да, это про меня"),
        h("button", { class: "ghost small", type: "button", onclick: () => { state.rejected.push(id); save(); render(); } }, "Не моё")
      );
    } else {
      act.append(h("button", { class: "pick", type: "button", "aria-pressed": on ? "true" : "false", onclick: () => { ui.warn = ""; choose(id); save(); render(); } }, on ? "Выбрано ✓" : "Выбрать"));
    }
    card.append(act);
    return card;
  }

  function screenSummary() {
    const a = analyse();
    const cands = Object.keys(a.score).filter((id) => !isChosen(id) && !isRejected(id)).sort((x, y) => a.score[y] - a.score[x]).slice(0, 6);
    const grid = h("div", { class: "vgrid" }, cands.map((id) => valueCard(id, a, "summary")));
    const confirmed = state.chosen.map((id) => (state.info[id] && state.info[id].name) || def(id)[0]);
    return [h("section", { class: "card soft" },
      h("div", { class: "q-label", text: "Промежуточный итог" }),
      h("h1", { class: "q-title", text: "Что уже проявилось" }),
      h("p", { class: "lead", text: "Эти ценности чаще всего звучат в твоих ответах. Если формулировка про тебя — подтверди её. Если нет — отложи. Решение можно поменять позже." }),
      counter(),
      confirmed.length ? h("p", { class: "hint-text" }, h("b", { text: "Уже подтверждены: " }), confirmed.join(", ")) : null,
      cands.length ? grid : h("p", { class: "lead", text: "Новых ценностей пока не проявилось. Идём дальше — следующие темы добавят материала." })
    ), nav({})];
  }

  function screenSelect() {
    const a = analyse();
    const all = Object.keys(C.values).concat(Object.keys(state.custom));
    const shown = all.filter((id) => (a.score[id] || 0) > 0 || isChosen(id) || state.custom[id])
      .sort((x, y) => (isChosen(y) - isChosen(x)) || ((isRejected(x) - isRejected(y))) || ((a.score[y] || 0) - (a.score[x] || 0)));
    const rest = all.filter((id) => !shown.includes(id));
    const nameIn = h("input", { type: "text", id: "newName", placeholder: "Например: Благодарность" });
    const meanIn = h("input", { type: "text", id: "newMean", placeholder: "Что она значит для тебя" });
    const n = state.chosen.length;
    return [h("section", { class: "card" },
      h("div", { class: "q-label", text: "Выбор" }),
      h("h1", { class: "q-title", text: "Выбери свои 10 ценностей" }),
      h("p", { class: "lead" }, "Отбери ", h("strong", { text: "ровно десять" }), " — те, на которые хочешь опираться. Следи, чтобы они не повторяли друг друга: если две ценности для тебя об одном и том же, оставь одну."),
      counter(),
      ui.warn ? h("p", { class: "warn", text: ui.warn }) : null,
      h("h2", { class: "section-title", text: "Проявились в твоих ответах" }),
      shown.length ? h("div", { class: "vgrid" }, shown.map((id) => valueCard(id, a, "select"))) : h("p", { class: "hint-text", text: "Пока ничего не отмечено — вернись к темам или выбери из полного списка ниже." }),
      rest.length ? h("div", null, h("button", { class: "ghost", type: "button", onclick: () => { ui.showAll = !ui.showAll; render(); } }, ui.showAll ? "Скрыть остальные ценности" : "Показать остальные ценности (" + rest.length + ")")) : null,
      ui.showAll ? h("div", { class: "vgrid" }, rest.map((id) => valueCard(id, a, "select"))) : null,
      h("h2", { class: "section-title", text: "Добавить свою ценность" }),
      h("div", { class: "vgrid" },
        h("div", { class: "field" }, h("label", { for: "newName", text: "Название" }), nameIn),
        h("div", { class: "field" }, h("label", { for: "newMean", text: "Что она значит" }), meanIn)),
      h("div", null, h("button", { class: "ghost", type: "button", onclick: () => {
        const name = nameIn.value.trim(); if (!name) { nameIn.focus(); return; }
        const id = "c" + (++state.customN);
        state.custom[id] = [name, lowerFirst(meanIn.value.trim())];
        choose(id); save(); render();
      } }, "Добавить и выбрать")),
      ownList()
    ), nav({ disabled: n !== 10, note: n === 10 ? "Готово: 10 из 10" : "Выбрано " + n + " из 10" })];
  }

  function screenDetails() {
    const cards = state.chosen.map((id, i) => {
      const inf = ensureInfo(id);
      const name = h("input", { type: "text", id: "n-" + id, "aria-label": "Название ценности" }); name.value = inf.name;
      const mean = h("textarea", { id: "m-" + id }); mean.value = inf.meaning;
      const ex = h("textarea", { id: "e-" + id }); ex.value = inf.example;
      name.addEventListener("input", () => { inf.name = name.value; save(); check(); });
      mean.addEventListener("input", () => { inf.meaning = mean.value; save(); });
      ex.addEventListener("input", () => { inf.example = ex.value; save(); });
      const imp = h("div", { class: "imp", role: "group", "aria-label": "Важность сейчас" });
      for (let k = 1; k <= 5; k++) {
        imp.append(h("button", { type: "button", "aria-pressed": inf.imp === k ? "true" : "false", onclick: () => {
          inf.imp = k; imp.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", j + 1 === k ? "true" : "false")); save(); check();
        } }, String(k)));
      }
      imp.append(h("small", { text: "1 — немного, 5 — очень" }));
      return h("div", { class: "dcard" },
        h("div", { class: "dhead" }, h("div", { class: "dnum", text: String(i + 1) }), name),
        h("div", { class: "field" }, h("label", { for: "m-" + id, text: "Что она означает именно для меня" }), mean),
        h("div", { class: "field" }, h("label", { for: "e-" + id, text: "Пример из моих ответов или жизни" }), ex),
        h("div", { class: "field" }, h("div", { class: "lbl", text: "Насколько важна сейчас" }), imp));
    });
    const n = nav({ disabled: true });
    const nextBtn = n.querySelector(".primary"), note = n.querySelector(".note");
    function check() {
      const done = state.chosen.filter((id) => ensureInfo(id).imp > 0 && ensureInfo(id).name.trim()).length;
      nextBtn.disabled = done !== state.chosen.length;
      note.textContent = "Оценено " + done + " из " + state.chosen.length;
    }
    check();
    return [h("section", { class: "card" },
      h("div", { class: "q-label", text: "Смысл и важность" }),
      h("h1", { class: "q-title", text: "Что они значат именно для тебя" }),
      h("p", { class: "lead", text: "Перепиши смысл своими словами — просто, как в разговоре по душам. Добавь пример и оцени, насколько каждая ценность важна сейчас. Одинаковые оценки — нормально." }),
      ownList(),
      ...cards
    ), n];
  }

  function makeStatement() {
    const parts = state.prio.map((id) => {
      const inf = ensureInfo(id);
      const m = (inf.meaning || "").trim().replace(/[.\s]+$/, "");
      return m ? lowerFirst(m) : lowerFirst(inf.name);
    });
    if (parts.length < 3) return "";
    return "Для меня важно " + parts[0] + ". Ещё мне важно " + parts[1] + " и " + parts[2] + ". Я хочу опираться на это в своих решениях и уделять этому больше внимания.";
  }

  function screenPrio() {
    const order = state.chosen.slice().sort((a, b) => ensureInfo(b).imp - ensureInfo(a).imp);
    if (!state.stmtEdited) state.statement = makeStatement();
    const st = h("textarea", { id: "stmt", style: "min-height:140px" }); st.value = state.statement;
    st.addEventListener("input", () => { state.statement = st.value; state.stmtEdited = true; save(); });
    const list = h("div", { class: "vgrid" }, order.map((id) => {
      const inf = ensureInfo(id), on = state.prio.includes(id);
      return h("div", { class: "vcard" + (on ? " on" : "") },
        h("div", { class: "vname" }, h("span", { text: inf.name }), h("span", { class: "score", text: "важность " + inf.imp + "/5" })),
        h("div", { class: "vact" }, h("button", { class: "pick", type: "button", "aria-pressed": on ? "true" : "false", onclick: () => {
          ui.warn = "";
          if (on) state.prio = state.prio.filter((x) => x !== id);
          else if (state.prio.length >= 3) ui.warn = "Уже выбрано три. Сними одну, чтобы выбрать другую.";
          else state.prio.push(id);
          save(); render();
        } }, on ? "Приоритет ✓" : "Сделать приоритетом")));
    }));
    return [h("section", { class: "card" },
      h("div", { class: "q-label", text: "Приоритеты" }),
      h("h1", { class: "q-title", text: "Три главных — сейчас" }),
      h("p", { class: "lead", text: "Выбери три ценности, которым ты хочешь уделять больше всего внимания в ближайшее время. Сначала отмечены те, что получили самые высокие оценки." }),
      ui.warn ? h("p", { class: "warn", text: ui.warn }) : null,
      list,
      h("div", { class: "field" }, h("label", { for: "stmt", text: "Описание от первого лица" }), st),
      h("div", { class: "row" },
        h("button", { class: "ghost small", type: "button", onclick: () => { state.stmtEdited = false; save(); render(); } }, "Собрать текст заново"),
        h("span", { class: "hint-text", text: "Текст можно переписать как угодно." }))
    ), nav({ disabled: state.prio.length !== 3 || !state.statement.trim(), label: "Получить итог", note: "Выбрано " + state.prio.length + " из 3" })];
  }

  function resultText() {
    const c = (x) => String(x || "").replace(/\|/g, "/").replace(/\n/g, " ");
    let md = "# Мои ценности\n\n| № | Моя ценность | Что она означает именно для меня | Пример из моих ответов |\n|---|---|---|---|\n";
    state.chosen.forEach((id, i) => {
      const inf = ensureInfo(id);
      md += `| ${i + 1} | ${c(inf.name)} (${inf.imp}/5) | ${c(inf.meaning)} | ${c(inf.example)} |\n`;
    });
    md += "\n## Три текущих приоритета\n\n" + state.prio.map((id, i) => `${i + 1}. ${ensureInfo(id).name}`).join("\n");
    md += "\n\n## Для меня важно\n\n" + state.statement.trim() + "\n";
    return md;
  }

  function screenResult() {
    const body = h("tbody");
    state.chosen.forEach((id, i) => {
      const inf = ensureInfo(id);
      body.append(h("tr", null,
        h("td", { class: "n", text: String(i + 1) }),
        h("td", { class: "v" }, inf.name, h("small", { text: "важность " + inf.imp + "/5" })),
        h("td", { "data-label": "Что она означает для меня", text: inf.meaning }),
        h("td", { class: "ex", "data-label": "Пример", text: inf.example })));
    });
    const note = h("span", { class: "hint-text" });
    const copy = () => {
      const txt = resultText();
      const fb = () => { note.textContent = "Не получилось скопировать автоматически — попробуй «Скачать файл»."; };
      try { navigator.clipboard.writeText(txt).then(() => { note.textContent = "Скопировано."; }, fb); } catch (e) { fb(); }
    };
    const download = () => {
      const blob = new Blob([resultText()], { type: "text/markdown;charset=utf-8" });
      const a = h("a", { href: URL.createObjectURL(blob), download: "мои-ценности.md" });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    return [h("section", { class: "card soft" },
      h("div", { class: "q-label", text: "Итог" }),
      h("h1", { class: "q-title" }, "Мои ", h("span", { class: "gold-text", text: "ценности" })),
      h("div", { class: "tablebox" }, h("table", null,
        h("thead", null, h("tr", null, h("th", { text: "№" }), h("th", { text: "Моя ценность" }), h("th", { text: "Что она означает именно для меня" }), h("th", { text: "Пример из моих ответов" }))),
        body)),
      h("div", { class: "field" }, h("div", { class: "lbl", text: "Три текущих приоритета" }),
        h("div", { class: "prio" }, state.prio.map((id) => h("div", { text: ensureInfo(id).name })))),
      h("div", { class: "field" }, h("div", { class: "lbl", text: "Моё описание" }), h("p", { class: "statement", text: state.statement.trim() })),
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", onclick: copy }, "Скопировать итог"),
        h("button", { class: "ghost", type: "button", onclick: download }, "Скачать файл"),
        navigator.share ? h("button", { class: "ghost", type: "button", onclick: () => navigator.share({ title: "Мои ценности", text: resultText() }).catch(() => {}) }, "Поделиться") : null,
        note)
    ), nav({ next: false })];
  }

  // ——— отрисовка ———
  function renderProgress() {
    const s = STEPS[state.step], pct = Math.round(state.step / (STEPS.length - 1) * 100);
    const p = document.getElementById("progress"); p.textContent = "";
    p.append(h("div", { class: "progress-row" }, h("b", { text: stepLabel(s) }), h("span", { text: "подтверждено " + state.chosen.length + " из 10" })),
      h("div", { class: "track" }, h("span", { style: "width:" + pct + "%" })));
  }

  function renderReset() {
    const zone = document.getElementById("resetZone"); zone.textContent = "";
    if (state.step === 0 && !Object.keys(state.picks).length) return;
    zone.append(h("button", { class: "ghost small", type: "button", onclick: () => {
      zone.textContent = "";
      zone.append(h("div", { class: "confirm" }, h("span", { text: "Стереть все ответы?" }),
        h("button", { class: "danger-btn", type: "button", onclick: () => { state = fresh(); save(); goto(0); } }, "Да, стереть"),
        h("button", { class: "ghost small", type: "button", onclick: renderReset }, "Отмена")));
    } }, "Начать заново"));
  }

  function render() {
    const s = STEPS[state.step] || STEPS[0];
    const app = document.getElementById("app"); app.textContent = "";
    let nodes;
    switch (s.type) {
      case "intro": nodes = screenIntro(); break;
      case "theme": nodes = screenTheme(s); break;
      case "summary": nodes = screenSummary(); break;
      case "select": nodes = screenSelect(); break;
      case "details": nodes = screenDetails(); break;
      case "prio": nodes = screenPrio(); break;
      default: nodes = screenResult();
    }
    app.append(...nodes.filter(Boolean));
    renderProgress(); renderReset();
  }

  // ——— установка на телефон ———
  const install = document.getElementById("install"), installBtn = document.getElementById("installBtn");
  let deferred = null;
  const dismissed = (() => { try { return localStorage.getItem(KEY + "-install") === "no"; } catch (e) { return false; } })();
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  document.getElementById("installClose").onclick = () => { install.hidden = true; try { localStorage.setItem(KEY + "-install", "no"); } catch (e) {} };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e;
    if (!dismissed && !standalone) { installBtn.hidden = false; install.hidden = false; }
  });
  installBtn.onclick = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; install.hidden = true; };
  window.addEventListener("appinstalled", () => { install.hidden = true; });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS && !standalone && !dismissed) {
    const p = document.getElementById("installText"); p.textContent = "";
    p.append(h("strong", { text: "Поставь приложение на iPhone: " }), "нажми «Поделиться» внизу экрана Safari, затем «На экран „Домой“».");
    install.hidden = false;
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  render();
})();
