1.	Introducció

Després d'implementar el cercador de Barcelona, volem ampliar les seves capacitats incorporant cerques específiques dins una capa vectorial d'un projecte. 
Per identificar quins projectes tenen cerques específiques, es farà servir una variable de capa QGIS. Si aquesta variable existeix, el cercador incorporarà un selector que permetrà canviar entre la cerca estàndard i la cerca específica (de manera similar a com ho fa Mapotip).
La cerca específica per a capes vectorials s'activarà mitjançant unes variables de capa que arribaran al client amb el valor del camp sobre el qual es vol buscar. Aquestes variables indicaran el nom de la cerca, el camp, i altres detalls necessaris. 
La cerca buscarà dins del projecte a la taula d'atributs del camp indicat. En cas que hi hagi dos camps, caldrà definir com gestionar aquesta situació.


2. Anàlisi 
2.1. Front End /Interfície Gràfica
El primer objectiu serà el de modificar i preparar el front-end per a la nova cerca. S’activarà una cerca específica per cada capa que contingui la variable qV_search. Aquesta variable es una variable de capa que l’editor del projecte estableix al projecte qgis.



2.1.1. Identificació de la petició de cerca específica:

Per activar automàticament la cerca específica, comprovarem si  ens arriba una o mes capes amb la variable qV_search, i que es sintàcticament correcte. Aquest procediment es realitzarà en temps de càrrega de component.

La sintaxis del camp que activa la cerca es:
qV_search=’field="CODI"  fieldtext="Codi" desc="introduïu codi"’

On 
field= Camp sobre el que es cerca
fieldtext= Etiqueta del camp a la cerca
desc=Placeholder (text que apareix al quadre de cerca)


 Per exemple,      qV_search=’field=”CODI” fieldText=”Codi Castanyera” desc=”Introduïu Codi” 
 
 Aquesta informació, pot arribar a varies capes.

 

2.1.2. Modificació component visual de la cerca
Un cop determinat que hi ha alguna cerca específica s’incorporarà un selector al cercador amb cascuna de les cerques.  La interfície tindrà un aspecte semblant al següent:

 

•	A partir d’aquí, les cerques que es facin aniran contra el servei especifica i per tant hi ha haurà una variable MODE_CERCA que controlarà aquest comportament.
•	Es retornaran els resultats amb coincidència per substring 
•	Nomes es permet la selecció d’un resultat, quan això succeeixi es farà zoom i es ressaltarà la feature.

•	Addicionalment, en el cas de que la capa sobre la que es busqui estigui desactivada, s’activarà



2.1.3. Cerca específica sobre la  capa vectorial


Donat que tenim totes les dades al client, farem un mètode al component Vue que cerqui sobre la capa vectorial


1.	Busquem la capa pel seu nom (layerName) entre les capes del mapa.
2.	Accedim a la font de dades de la capa i seleccionem el camp especificat a qV_search.
3.	Filtrarem les features que continguin el text cercat en el camp especificat.
4.	Creem suggeriments amb el text, mínim 2-3 caràcters.
5.	Se selecciona nomes un dels suggeriments. 
6.	Zoom a la feature: En seleccionar un suggeriment, utilitzem la geometria original de la feature per fer zoom.
 

2.2. Capa de Negoci
2.2.1. Modificació Back-End per incorporar variable a projecte
Hem de modificar la capa de negoci ( golang server) per a que la variable de la capa amb la informació de la cerca arribi al json (que es el que arriba al client).

Donat que el plugin de QGIS, ja puja/actualitza una copia del projecte QGIS al server, no caldrà modificar-lo
Caldrà, però ,modificar les funcions que creen/actualitzen el project.json per que llegeixi el QGS i incorpori la variable QGIS, al fitxer project.json.
.
