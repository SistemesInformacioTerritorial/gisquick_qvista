// Mock data per provar la funcionalitat de cerca específica
export const mockProjectData = {
  "layers": [
    {
      "name": "parceles",
      "title": "Parcel·les",
      "visible": true,
      "queryable": true,
      "type": "vector",
      "geom_type": "polygon",
      "attributes": [
        {
          "name": "CODI",
          "type": "text"
        },
        {
          "name": "DESCRIPCIO", 
          "type": "text"
        }
      ],
      // Variable qV_search simulada
      "qV_search": 'field="CODI" fieldtext="Codi Parcel·la" desc="Introduïu el codi de la parcel·la"'
    },
    {
      "name": "municipis",
      "title": "Municipis",
      "visible": false,
      "queryable": true,
      "type": "vector",
      "geom_type": "polygon",
      "attributes": [
        {
          "name": "NOM_MUNI",
          "type": "text"
        },
        {
          "name": "CODI_INE",
          "type": "text"
        }
      ],
      // Altra variable qV_search
      "qV_search": 'field="NOM_MUNI" fieldtext="Nom Municipi" desc="Introduïu el nom del municipi"'
    },
    {
      "name": "carrers",
      "title": "Carrers",
      "visible": true,
      "queryable": true,
      "type": "vector", 
      "geom_type": "linestring",
      "attributes": [
        {
          "name": "NOM_CARRER",
          "type": "text"
        }
      ]
      // Aquesta capa no té qV_search
    }
  ],
  "root_group": {
    "layers": ["parceles", "municipis", "carrers"]
  }
}

// Mock search results
export const mockSearchResults = {
  "parceles": [
    {
      "CODI": "PARC001",
      "DESCRIPCIO": "Parcel·la urbana centre",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.1, 41.4], [2.11, 41.4], [2.11, 41.41], [2.1, 41.41], [2.1, 41.4]]]
      }
    },
    {
      "CODI": "PARC002", 
      "DESCRIPCIO": "Parcel·la residencial",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.12, 41.4], [2.13, 41.4], [2.13, 41.41], [2.12, 41.41], [2.12, 41.4]]]
      }
    },
    {
      "CODI": "PARC010",
      "DESCRIPCIO": "Parcel·la industrial",
      "geometry": {
        "type": "Polygon", 
        "coordinates": [[[2.14, 41.4], [2.15, 41.4], [2.15, 41.41], [2.14, 41.41], [2.14, 41.4]]]
      }
    }
  ],
  "municipis": [
    {
      "NOM_MUNI": "Barcelona",
      "CODI_INE": "08019",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.0, 41.3], [2.2, 41.3], [2.2, 41.5], [2.0, 41.5], [2.0, 41.3]]]
      }
    },
    {
      "NOM_MUNI": "Girona",
      "CODI_INE": "17079",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.8, 41.9], [2.9, 41.9], [2.9, 42.0], [2.8, 42.0], [2.8, 41.9]]]
      }
    }
  ]
}
