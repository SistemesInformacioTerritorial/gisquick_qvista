import axios from 'axios'
import { toLonLat, fromLonLat } from 'ol/proj'
import Point from 'ol/geom/Point'
import Feature from 'ol/Feature'

export class SearchService {
  constructor(map) {
    this.map = map
  }

  // Servicio de Barcelona
  barcelonaService() {
    return {
      autocomplete: async (text) => {
        const [x, y] = this.map.getView().getCenter()
        const [lon, lat] = toLonLat([x, y], this.map.getView().getProjection())
        const response = await axios.get(`https://w33.bcn.cat/geoBCN/serveis/territori?q=${text}&max=8&out_proj=EPSG:4326`)
        
        let suggestions = response.data.resultats.adreces
        const carrers = response.data.resultats.vies
        let isAdreca = false
        if(text.match(/\d+$/)) isAdreca = true
        
        if(carrers.length > 1 && !isAdreca) {
          suggestions = carrers
        } else if(suggestions.length === 1 && carrers && carrers.length > 1) {
          suggestions = suggestions.concat(carrers)
        }
        
        suggestions.forEach(i => {
          i.text = i.nomComplet
          i.geom = new Point(fromLonLat([i.localitzacio.x, i.localitzacio.y], this.map.getView().getProjection()))
        })
        
        return Object.freeze(suggestions)
      },
      
      getFeature: async (item) => {
        return new Feature({ geometry: item.geom })
      }
    }
  }

  // Servicio de coordenadas
  coordsService() {
    const HDMSRegex = /^(\d{1,2})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d{1})?)[\"″]\s*([NS])\s*(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d{1})?)[\"″]\s*([EW])$/
    const LonLatRegex = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
    
    const parseHDMS = (input) => {
      const parts = input.split(/[°'"′″\s]+/)
      const latDegrees = parseFloat(parts[0])
      const latMinutes = parseFloat(parts[1])
      const latSeconds = parseFloat(parts[2])
      const lonDegrees = parseFloat(parts[4])
      const lonMinutes = parseFloat(parts[5])
      const lonSeconds = parseFloat(parts[6])
      const latHemisphere = parts[3]
      const lonHemisphere = parts[7]
      const latitude = latDegrees + latMinutes / 60 + latSeconds / 3600
      const longitude = lonDegrees + lonMinutes / 60 + lonSeconds / 3600
      const finalLatitude = latHemisphere === 'S' ? -latitude : latitude
      const finalLongitude = lonHemisphere === 'W' ? -longitude : longitude
      return [finalLongitude, finalLatitude]
    }

    return {
      searchByCoords: (text) => {
        let coords
        if (HDMSRegex.test(text)) {
          try {
            coords = parseHDMS(text)
          } catch (err) {}
        } else if (LonLatRegex.test(text)) {
          coords = text.split(',').map(parseFloat).reverse()
        }
        if (coords) {
          const p = new Point(fromLonLat(coords, this.map.getView().getProjection()))
          return new Feature({ geometry: p })
        }
        return null
      }
    }
  }
}