#  QVistaWeb - MapSPA

QVistaWeb es una plataforma per compartir projectes QGis a la web
 que fa servir una adaptació de [Gisquick](http://gisquick.org) modificada
 per a funcionar en plataforma windows sense contenidors.

## 1. Introduccio/QVista Web dins la Arquitectura global del sistema 

Goisquick-web es la aplicació que mostra els mapes als usuaris i permet fer cerques, geometries, seleccionar capes,...
Aquesta aplicació es comunica (a traves de l'Apache) amb el servidor GisQuickServerNext que fa d'intermediari amb
la resta del backend. Des d'ella també s'accedeix a l'edició de mapes, i tambñe està conectada amb l'aplicació de
gestió d'usuaris ( les altres dues SPA que resten inalterades )

La llista de components del sistema és:

1. Gisquick-web --> Visor de Mapes.
2. SAP - User --> Edició de projectes d'usari.
3. SAP Admin --> Administració d'usuaris.
4.  GisQuickServerNext -->  Backend en Golang. Conecta el conjunt de l'arquitectura.
5.  PostGress --> Gestió d'usuaris.
6.  Redis --> Gestió de sessions i notificacions.
7.  QGisServer --> Renderitza els mapes.
8.  Apache --> WebServer i Reverseproxy
9.  Gisquick Plug-in: Comunica  el QGis Desktop amb el servidor apache, i a través d'ell amb el back-end.

## 2. Gisquick-web (SPA Map)
S'han fet algunes modificacions a aquest projecte open source per que encaixi amb els requeriments
  a. Capçalera amb logo i titol del mapa ( component MapNameBar.Vue)
  b. Modificació del look&feel  (modificant les variables de color del scss)
  c. Traducció dels literals (fent servir i18m)

La següent guia explica com canviar a aquestes modificacions

## 3. Guia per la Modificació del Front End
  
Per configurar el front-end cal modificar el codi font, fer un build i pujarlo al servidor.
Abans peró cal tenir un entorn de desenvolupament.


  ### 3.2 Configuració del entorn
  1. Instalar VSCode
  2. Cal tenir instalada la versio 20 del node per compilar sense problemes
     
     ![image](https://github.com/user-attachments/assets/1dde0a59-fdc0-4344-9105-3655e3a9ba8e)

      si es té una altra caldra instalar el NVM (node version manager) per poder fer-la servir

     ` nvm use 20 `
  
  
  3. Configurar l'acces al servidor (per defecte localhost:80 ) al l'arxiu vue.config.js
   
     ![image](https://github.com/user-attachments/assets/7fbd8445-2d5e-4e64-90cc-ca77c1042369)

    
  4. Comprobem que tot funciona. Obrirem la carpeta clients\gisquick de del code i instalarem el projecte

     ```
         npm install #(si no s'ha fet abans)
         npm run serve #(obre un servidor local)
     ```

       ![image](https://github.com/user-attachments/assets/edc52a52-a8bd-4c79-ab5e-cc51ae64a900)

     ![image](https://github.com/user-attachments/assets/89de600e-48f9-4f28-bf89-a427e262f4cf)

  ### 3.3 Modificació del Look and Feel
  
  1. modificar l'arxiu theme.css.
  
     ![image](https://github.com/user-attachments/assets/33486c60-241d-49f5-9985-b577fd42d25a)
     
 
  3. i a continuació compilar
     ```
         npm run build
       ```
     
  ### 3.4 Missatges en català

  Aquesta versió mostrarà per defecte els missatges en català. Les passes per canviar/afegir una traducció són:
  
  
  1. modificar l'arxiu ca.po que es troba dins la carpeta i18 del projecte
     
  ![image](https://github.com/user-attachments/assets/bb750b35-7186-4044-b0c7-8d99724866b5)
    
     
  2. Compilar i fer buld dels missatges amb les comandes:
     ```
             npm run compilemessages
             npm run makemessages
             
     ```
      

### 3.5 Desplegament

  1. Compilar el projecte per producció

     ```
      npm run build
     ```
  2. Copiar el contigut de la carpeta dist
     
     ![image](https://github.com/user-attachments/assets/83ed89f6-55b6-4837-8841-39a418def218)

   a la carpeta c:\gisquick-pre\www\html\map
   (entorn de preproducció)

  

  
  
## License

[GNU General Public License version
2](https://github.com/gisquick/gisquick/blob/master/LICENSE) or
later.

## Contact


