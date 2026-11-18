/**
 * Tema claro e escuro.
 *
 * Sem escolha guardada, segue o computador da pessoa e acompanha a troca do
 * sistema ao vivo. O botão do menu guarda a escolha neste navegador, e
 * "Seguir o computador", no menu da conta, a apaga. A escolha mora no
 * `localStorage`, e não no banco: é do aparelho, não da conta, e precisa ser
 * lida antes da primeira pintura, quando ainda não há sessão no navegador.
 *
 * A classe `.dark` no `<html>` é o contrato dos tokens da Central.
 */
export const CHAVE_DO_TEMA = 'auvp-tema'

export type Tema = 'claro' | 'escuro'

/**
 * Roda no `<head>`, antes da primeira pintura, para não piscar claro. Expõe
 * `__aplicarTema` para o botão reaplicar depois de gravar a escolha, e escuta
 * `storage` para outra aba aberta acompanhar.
 */
export const SCRIPT_DO_TEMA = `(function(){var d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)');function a(){var t=null;try{t=localStorage.getItem('${CHAVE_DO_TEMA}')}catch(e){}d.classList.toggle('dark',t==='escuro'||(t!=='claro'&&m.matches))}a();m.addEventListener('change',a);addEventListener('storage',a);window.__aplicarTema=a})()`

declare global {
  interface Window {
    __aplicarTema?: () => void
  }
}

/** Grava a escolha (ou a apaga, com `null`) e aplica na hora. */
export function escolherTema(tema: Tema | null) {
  try {
    if (tema) localStorage.setItem(CHAVE_DO_TEMA, tema)
    else localStorage.removeItem(CHAVE_DO_TEMA)
  } catch {
    // Navegador sem armazenamento: troca só nesta página.
    if (tema) document.documentElement.classList.toggle('dark', tema === 'escuro')
    return
  }
  window.__aplicarTema?.()
}
