Por supuesto, aquí tienes el **reporte ampliado** para backend, incluyendo ejemplos reales de tu configuración, URLs y errores observados:

---

## **Reporte de incidencia: Problemas de carga de capas y búsqueda específica en visor GIS**

### **Resumen del problema**
- El visor GIS no puede cargar ni visualizar la capa `"Equipaments - Cultura i lleure"` ni mostrar su tabla de atributos.
- Todas las peticiones WMS y WFS para esta capa fallan con error 400 y mensajes como:
  ```
  <ServiceException code="LayerNotDefined">The layer 'Equipaments - Cultura i lleure' does not exist.</ServiceException>
  ```
- El problema ocurre **incluso antes de usar la búsqueda**, simplemente al cargar el mapa.

---

### **Datos y ejemplos reales**

#### **1. Configuración JSON de la capa**
```json
{
  "title": "Equipaments - Cultura i lleure",
  "name": "Equipaments - Cultura i lleure",
  "qgis_id": "Equipaments___Cultura_i_lleure_9f8826e5_2b63_40dd_969b_619120f559fe",
  "qV_search": "field=\"NOM_EQUIP\" fieldText=\"Nom\"",
  ...
}
```
- El campo `"name"` contiene espacios y acentos.

#### **2. Ejemplo de petición WMS fallida**
```
GET http://localhost:82/api/map/ows/int/cultureta?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=Equipaments - Cultura i lleure&...
```
**Respuesta:**
```xml
<ServiceExceptionReport xmlns="http://www.opengis.net/ogc" version="1.3.0">
 <ServiceException code="LayerNotDefined">The layer 'Equipaments - Cultura i lleure' does not exist.</ServiceException>
</ServiceExceptionReport>
```

#### **3. Ejemplo de petición WFS fallida**
```
POST http://localhost:82/api/map/ows/int/cultureta?VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&OUTPUTFORMAT=GeoJSON&resultType=hits
<wfs:Query typeName="Equipaments - Cultura i lleure" ...>
```
**Respuesta:**
```xml
<ServiceException code="LayerNotDefined">The layer 'Equipaments - Cultura i lleure' does not exist.</ServiceException>
```

#### **4. Fragmento de HAR**
```json
{
  "request": {
    "url": "http://localhost:82/api/map/ows/int/cultureta?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=Equipaments - Cultura i lleure&...",
    ...
  },
  "response": {
    "status": 400,
    "content": {
      "text": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<ServiceExceptionReport ...>The layer 'Equipaments - Cultura i lleure' does not exist.</ServiceException>\n</ServiceExceptionReport>\n"
    }
  }
}
```

---

### **Hipótesis técnica**
- El backend **no está exponiendo la capa con el nombre exacto** `"Equipaments - Cultura i lleure"` en los servicios OGC.
- Es probable que el nombre interno de la capa haya cambiado, o que el backend ahora requiera un nombre diferente (sin espacios, acentos, o con guiones bajos).
- El frontend utiliza el campo `"name"` del JSON para construir las peticiones, y espera que coincida exactamente con el nombre interno publicado por el backend.

---

### **Recomendaciones para backend**

1. **Verificar el nombre interno de la capa expuesto por el servicio WMS/WFS**:
   - Realizar una petición `GetCapabilities`:
     ```
     http://localhost:82/api/map/ows/int/cultureta?SERVICE=WMS&REQUEST=GetCapabilities
     ```
   - Buscar el bloque `<Layer><Name>...</Name></Layer>` correspondiente a la capa problemática.

2. **Asegurarse de que el backend acepte el nombre de capa que el frontend está enviando**:
   - Si el nombre interno ha cambiado, actualizar el JSON de configuración del frontend para usar el nombre correcto.
   - Si el backend espera un nombre transformado, documentar la convención para que el frontend la aplique.

3. **Revisar los cambios recientes en la lógica de publicación de capas y búsquedas**:
   - Comprobar si se ha modificado la forma en que se exponen los nombres de capa o se gestionan los alias.

---

### **Resumen**

- **El nombre de capa en las peticiones debe coincidir exactamente con el nombre interno expuesto por el backend WMS/WFS.**
- **No uses espacios ni acentos en el campo `"name"` de la capa.**
- **Corrige el nombre en QGIS y/o en tu configuración JSON, o ajusta el backend para aceptar el nombre que envía el frontend.**

---

**Adjunto ejemplos de configuración, URLs y respuestas reales para facilitar el diagnóstico.**  
¿Necesitas que añada algún detalle más?   - Buscar el bloque `<Layer><Name>...</Name></Layer>` correspondiente a la capa problemática.

2. **Asegurarse de que el backend acepte el nombre de capa que el frontend está enviando**:
   - Si el nombre interno ha cambiado, actualizar el JSON de configuración del frontend para usar el nombre correcto.
   - Si el backend espera un nombre transformado, documentar la convención para que el frontend la aplique.

3. **Revisar los cambios recientes en la lógica de publicación de capas y búsquedas**:
   - Comprobar si se ha modificado la forma en que se exponen los nombres de capa o se gestionan los alias.

---

### **Resumen**

- **El nombre de capa en las peticiones debe coincidir exactamente con el nombre interno expuesto por el backend WMS/WFS.**
- **No uses espacios ni acentos en el campo `"name"` de la capa.**
- **Corrige el nombre en QGIS y/o en tu configuración JSON, o ajusta el backend para aceptar el nombre que envía el frontend.**

---

**Adjunto ejemplos de configuración, URLs y respuestas reales para facilitar el diagnóstico.**  
¿Necesitas que añada algún detalle más?