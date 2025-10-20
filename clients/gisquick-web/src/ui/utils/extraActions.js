export async function runAction(action) {
  if (action.action_type === '5' || action.action_type === '7') {
    const value = action.filtered_action?.trim()
    if (!value) return console.warn('Acción vacía')


    const dynamicUrl = `${window.location.origin}/api/project/download/${window.project}/${value}`

    try {
      const res = await fetch(dynamicUrl, { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`)
      }

      const blob = await res.blob()
      const fileUrl = URL.createObjectURL(blob)

      window.open(fileUrl, '_blank')

    } catch (err) {
      window.open(action.filtered_action, '_blank') // abre enlace
    }

  } else {
    console.warn('Tipo de acción no reconocida:', action.action_type)
  }
}
