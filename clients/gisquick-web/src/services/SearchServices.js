import axios from 'axios';
import { toLonLat, fromLonLat, transformExtent } from 'ol/proj';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';

export class SearchServices {
  constructor(http, map) {
    this.http = http;
    this.map = map;
  }

  // Servicio Barcelona (existente)
  barcelonaService() {
    return {
      autocomplete: async (text) => {
        const [x, y] = this.map.getView().getCenter();
        const [lon, lat] = toLonLat([x, y], this.map.getView().getProjection());
        const response = await axios.get(`https://w33.bcn.cat/geoBCN/serveis/territori?q=${text}&max=8&out_proj=EPSG:4326`);
        
        let suggestions = response.data.resultats.adreces;
        const carrers = response.data.resultats.vies;
        let isAdreca = false;
        if(text.match(/\d+$/)) isAdreca = true;
        
        if(carrers.length > 1 && !isAdreca) {
          suggestions = carrers;
        } else if(suggestions.length === 1 && carrers && carrers.length > 1) {
          suggestions = suggestions.concat(carrers);
        }
        
        suggestions.forEach(i => {
          i.text = i.nomComplet;
          i.geom = new Point(fromLonLat([i.localitzacio.x, i.localitzacio.y], this.map.getView().getProjection()));
        });
        
        return Object.freeze(suggestions);
      },
      
      getFeature: async (item) => {
        return new Feature({ geometry: item.geom });
      }
    };
  }

  // Servicio ArcGIS (existente)
  arcgisService(project) {
    const wkid = project.config.projection.split(':')?.[1];
    const formatExtent = extent => {
      const [ xmin, ymin, xmax, ymax ] = extent;
      return JSON.stringify({
        xmin, ymin, xmax, ymax,
        spatialReference: { wkid }
      });
    };
    
    const formatLocation = coords => {
      const [x, y] = coords;
      return JSON.stringify({
        x: this.map.ext.formatCoordinate(x),
        y: this.map.ext.formatCoordinate(y),
        spatialReference: { wkid }
      });
    };
    
    const projectExtent = formatExtent(project.config.project_extent);
    
    return {
      autocomplete: async (text) => {
        const params = {
          text,
          location: formatLocation(this.map.getView().getCenter()),
          searchExtent: projectExtent,
          maxSuggestions: 8,
          f: 'json',
          distance: 10000
        };
        
        const { data } = await this.http.get(`/api/map/search/${project.config.name}/suggest`, { params });
        return data.suggestions;
      },
      
      getFeature: async (item) => {
        const { text, magicKey } = item;
        const params = {
          text,
          magicKey: magicKey,
          SingleLine: text,
          searchExtent: projectExtent,
          location: formatLocation(this.map.getView().getCenter()),
          outSR: wkid,
          f: 'json'
        };
        
        const { data } = await this.http.get(`/api/map/search/${project.config.name}/findAddressCandidates`, { params });
        const result = data.candidates[0];
        
        if (result) {
          const { x, y } = result.location;
          return new Feature({ geometry: new Point([x, y]) });
        }
        
        return null;
      }
    };
  }

  // Servicio Geoapify (existente)
  geoapifyService(project) {
    return {
      autocomplete: async (text) => {
        const [x, y] = this.map.getView().getCenter();
        const [lon, lat] = toLonLat([x, y], this.map.getView().getProjection());
        const projectExtent = project.config.project_extent;
        const viewExtent = this.map.getView().calculateExtent();
        
        const filters = [
          `rect:${transformExtent(projectExtent, this.map.getView().getProjection(), 'EPSG:4326')}`
        ];
        
        const biases = [
          `proximity:${lon},${lat}`,
          `rect:${transformExtent(viewExtent, this.map.getView().getProjection(), 'EPSG:4326')}`
        ];
        
        const params = {
          text,
          format: 'json',
          filter: filters.join('|'),
          bias: biases.join('|')
        };
        
        const { data } = await this.http.get(`/api/map/search/${project.config.name}/autocomplete`, { params });
        const suggestions = data.results;
        
        suggestions.forEach(i => {
          i.text = i.formatted;
          i.geom = new Point(fromLonLat([i.lon, i.lat], this.map.getView().getProjection()));
        });
        
        return Object.freeze(suggestions);
      },
      
      getFeature: async (item) => {
        return new Feature({ geometry: item.geom });
      }
    };
  }

  // NUEVO: Servicio de búsqueda WFS con XML
  wfsXmlService(store) {
    return {
      autocomplete: async (searchConfig, text) => {
        if (text.length < 2) return [];
        
        try {
          console.log('🔍 [wfsXmlService] Buscando:', text, 'en capa:', searchConfig.layerName, 'campo:', searchConfig.field);
          
          const searchText = text.toLowerCase();
          
          // Usar formato XML exacto que funciona
          const xmlRequest = `<GetFeature
 xmlns="http://www.opengis.net/wfs"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:gml="http://www.qgis.org/gml"
 xmlns:ogc="http://www.opengis.net/ogc"
>
 <wfs:Query typeName="${searchConfig.layerName}" xmlns:feature="http://www.qgis.org/gml">
<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">
    <ogc:PropertyIsLike wildCard="%" singleChar="_" escapeChar="\\" matchCase="false">
      <ogc:PropertyName>${searchConfig.field}</ogc:PropertyName>
      <ogc:Literal>%${searchText}%</ogc:Literal>
    </ogc:PropertyIsLike></ogc:Filter>
<ogc:SortBy><ogc:SortProperty><ogc:PropertyName>${searchConfig.field}</ogc:PropertyName><ogc:SortOrder>asc</ogc:SortOrder></ogc:SortProperty></ogc:SortBy>
</wfs:Query>
</GetFeature>`;
          
          const projectName = store.state.project?.config?.project || 'int/cultureta';
          
          // CORRECCIÓN: Añadir los parámetros necesarios a la URL
          const url = `/api/map/ows/${projectName}?VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&OUTPUTFORMAT=GeoJSON`;
          
          console.log('🔍 [wfsXmlService] URL:', url);
          console.log('🔍 [wfsXmlService] XML enviado:', xmlRequest);
          
          // CORRECCIÓN: Cambiar Content-Type a text/xml
          const response = await this.http.post(url, xmlRequest, {
            headers: {
              'Content-Type': 'text/xml',
            },
          });
          
          // Depurar la respuesta
          console.log('🔍 [wfsXmlService] Tipo de respuesta:', typeof response.data);
          console.log('🔍 [wfsXmlService] Respuesta tiene features:', !!response.data?.features);
          
          if (!response.data || !response.data.features || !response.data.features.length) {
            return [{
              text: `No s'han trobat resultats per "${text}"`,
              info: true,
              error: false
            }];
          }
          
          // Generar sugerencias a partir de las features
          const suggestions = response.data.features.map((feature) => ({
            text: feature.properties[searchConfig.field],
            feature,
            properties: feature.properties,
            source: 'wfsXml'
          }));
          
          console.log('✅ [wfsXmlService] Encontradas', suggestions.length, 'sugerencias');
          
          return suggestions.slice(0, 10); // Limitar a 10 resultados
          
        } catch (error) {
          console.error('❌ [wfsXmlService] Error:', error);
          console.error('❌ [wfsXmlService] Detalles:', error.response?.data || error.message);
          
          return [{
            text: `Error: ${error.message}`,
            info: true,
            error: true
          }];
        }
      },
      
      getFeature: async (item) => {
        if (item.info) return null;
        
        if (item.feature && item.feature.geometry) {
          // Convertir la geometría GeoJSON a Feature de OpenLayers
          const format = new GeoJSON();
          const feature = format.readFeature(item.feature, {
            featureProjection: this.map.getView().getProjection().getCode()
          });
          
          console.log('✅ [wfsXmlService] Feature convertida correctamente');
          return feature;
        }
        
        return null;
      }
    };
  }
}