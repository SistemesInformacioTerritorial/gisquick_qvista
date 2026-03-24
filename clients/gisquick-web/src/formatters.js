import has from 'lodash/has'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'

function resolveActionTokenValue (token, feature) {
  const value = token.trim()
  if (!value) {
    return ''
  }
  if (value === '@project_folder') {
    return ''
  }
  return feature.get(value) ?? ''
}

function resolveConcatExpression (expression, feature) {
  const match = expression.match(/^\s*concat\s*\((.*)\)\s*$/s)
  if (!match) {
    return resolveActionTokenValue(expression, feature)
  }

  const tokens = match[1].match(/'[^']*'|"[^"]*"|[^,]+/g) || []
  return tokens
    .map(token => {
      const value = token.trim()
      if (value.startsWith("'")) {
        return value.slice(1, -1)
      }
      if (value.startsWith('"')) {
        return resolveActionTokenValue(value.slice(1, -1), feature)
      }
      return resolveActionTokenValue(value, feature)
    })
    .join('')
}

export function resolveActionText (actionText, feature) {
  if (typeof actionText !== 'string') {
    return actionText
  }

  return actionText.replaceAll(/\[%([\s\S]*?)%\]/g, (_, expression) => {
    return resolveConcatExpression(expression, feature)
  })
}

export function applyLayerActions (layer, features) {
  const actions = layer?.actions || []

  features.forEach(feature => {
    feature.set(
      'actions',
      actions.map(action => ({
        ...action,
        filtered_action: resolveActionText(action.action_text, feature)
      })),
      true
    )
  })

  return features
}

export function createFormatter (params) {
  let { locale, config } = params
  if (!locale) {
    locale = navigator.language || navigator.languages[0]
  }
  const nf = new Intl.NumberFormat(locale, config)
  return {
    format: v => Number.isFinite(v) ? nf.format(v) : v
  }
}

function createProjectFormatters (project) {
  const formatters = keyBy(project.config.formatters, 'name')
  return mapValues(formatters, f => createFormatter(f))
}

function _formatFeatures (features, formatters) {
  features.forEach(f => {
    f._formattedProperties = mapValues(formatters, (formetter, name) => formetter.format(f.get(name)))

    Object.defineProperty(f, 'getFormatted', {
      value: function (key) {
        return has(this._formattedProperties, key) ? this._formattedProperties[key] : this.get(key)
      }
    })
    Object.defineProperty(f, 'getFormattedProperties', {
      value: function () {
        return this._formattedProperties
      }
    })
  })
}

export function formatFeatures (project, layer, features) {
  if (!project.formatters) {
    project.formatters = createProjectFormatters(project)
  }
  const layerFormatters = mapValues(
    keyBy(layer.attributes?.filter(attr => attr.format), 'name'),
    attr => project.formatters[attr.format]
  )
  _formatFeatures(features, layerFormatters)
  applyLayerActions(layer, features)
  return features
}
