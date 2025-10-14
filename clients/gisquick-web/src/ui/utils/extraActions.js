export function runAction(action) {
  if (action.action_type === '5' || action.action_type === '7') {
    window.open(action.filtered_action, '_blank') // abre enlace
  } else {
    console.warn('Tipo de acción no reconocida:', action.action_type)
  }
}
