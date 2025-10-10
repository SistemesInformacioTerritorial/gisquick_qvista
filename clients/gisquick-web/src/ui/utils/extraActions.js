export function runAction(action, item) {
  if (action.action_type === '5') {
    window.open(action.action_text, '_blank') // abre enlace
  } else {
    console.warn('Tipo de acción no reconocido:', action.action_type)
  }
}
