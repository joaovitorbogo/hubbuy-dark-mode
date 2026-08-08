/* hubbuy dark mode - content script
 *
 * O CSS do tema fica sempre injetado, mas todas as regras sao escopadas em
 * `html.hbb-dark`. Ligar/desligar e so mexer na classe do <html>: nao recarrega
 * a pagina e nao pisca.
 */
(() => {
  'use strict';

  const ROOT_CLASS = 'hbb-dark';
  const DIM_CLASS = 'hbb-dim';
  const NOBANNER_CLASS = 'hbb-nobanner';
  const DEFAULTS = {
    enabled: true,
    followSystem: false,
    dimMedia: true,      // os banners do hubbuy sao claros demais sem isso
    hideBanner: false,
  };

  function boot(html) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    // Estado ainda desconhecido (storage e assincrono). Como "ligado" e o caso
    // normal, aplicamos ja no document_start para evitar o flash branco. Se a
    // preferencia for outra, a correcao chega poucos milissegundos depois.
    html.classList.add(ROOT_CLASS);
    if (DEFAULTS.dimMedia) html.classList.add(DIM_CLASS);

    let config = { ...DEFAULTS };
    let ready = false;
    let applying = false;

    const isOn = (cfg) => cfg.enabled && (!cfg.followSystem || media.matches);

    function render() {
      const on = isOn(config);
      // O MutationObserver abaixo reage a mudancas de classe; a flag evita que
      // as nossas proprias escritas disparem um novo ciclo.
      applying = true;
      html.classList.toggle(ROOT_CLASS, on);
      html.classList.toggle(DIM_CLASS, on && config.dimMedia);
      // Esconder o banner independe do tema: quem so quer se livrar da faixa
      // promocional nao precisa ficar com o site escuro.
      html.classList.toggle(NOBANNER_CLASS, config.hideBanner);
      applying = false;
    }

    chrome.storage.sync.get(DEFAULTS, (stored) => {
      ready = true;
      if (chrome.runtime.lastError) return; // sem sync: segue no padrao (ligado)
      config = { ...DEFAULTS, ...stored };
      render();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      let touched = false;
      for (const key of Object.keys(DEFAULTS)) {
        if (key in changes) {
          config[key] = changes[key].newValue;
          touched = true;
        }
      }
      if (touched) render();
    });

    media.addEventListener('change', () => {
      if (config.followSystem) render();
    });

    // O Nuxt reescreve o atributo class do <html> durante a hidratacao e em
    // algumas transicoes de rota, o que apagaria o tema no meio da navegacao.
    // Sem este observer o tema simplesmente nao gruda nesta SPA.
    new MutationObserver(() => {
      if (applying || !ready) return;
      const stale =
        html.classList.contains(ROOT_CLASS) !== isOn(config) ||
        html.classList.contains(DIM_CLASS) !== (isOn(config) && config.dimMedia) ||
        html.classList.contains(NOBANNER_CLASS) !== !!config.hideBanner;
      if (stale) render();
    }).observe(html, { attributes: true, attributeFilter: ['class'] });
  }

  // Em execucoes muito precoces o <html> ainda nao existe e documentElement e
  // null. Espera o parser criar a raiz antes de aplicar qualquer coisa.
  if (document.documentElement) {
    boot(document.documentElement);
  } else {
    const waiting = new MutationObserver(() => {
      if (!document.documentElement) return;
      waiting.disconnect();
      boot(document.documentElement);
    });
    waiting.observe(document, { childList: true });
  }
})();
