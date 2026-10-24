# Video de los cursos

El video de cada parte del curso puede venir de tres sitios. Se elige con una
sola variable de entorno, `VIDEO_PROVEEDOR`, y **no hay que tocar codigo** para
cambiar: el panel y el reproductor se adaptan a lo que responda el servidor.

| `VIDEO_PROVEEDOR` | De donde sale el video | Que cuesta |
| --- | --- | --- |
| `youtube` | Se pega el enlace, como hasta ahora | Nada, pero el video existe en youtube.com |
| `r2` | Cloudflare R2, nuestro propio almacen | Almacenamiento; el trafico no se cobra |
| `stream` | Cloudflare Stream, con varias calidades | Por minuto guardado y por minuto visto |

Lo importante: **cambiar la variable solo decide donde van los videos nuevos**.
Cada leccion guarda de donde sale el suyo (`r2:...`, `stream:...` o el enlace de
YouTube), asi que lo que ya esta sigue reproduciendose igual. Los tres conviven
sin migrar nada.

## Poner Cloudflare R2

1. En el panel de Cloudflare, **R2 > Create bucket**. Anota el nombre.
2. **Manage R2 API Tokens > Create API token**, con permiso de lectura y
   escritura sobre ese bucket. Da tres datos: Access Key ID, Secret Access Key y
   el Account ID.
3. El navegador sube el archivo directo al bucket, asi que el bucket necesita
   una regla de CORS. En **Settings > CORS policy**:

```json
[
  {
    "AllowedOrigins": ["https://hycon-sigma.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

4. En el `.env`:

```
VIDEO_PROVEEDOR=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
```

El bucket se queda **privado**. El backend firma un enlace temporal cada vez que
alguien con derecho a ver la leccion pide el temario, y ese enlace caduca a los
`VIDEO_FIRMA_MINUTOS`.

## Poner Cloudflare Stream

1. **Stream > Videos**: ahi aparece el dominio del reproductor, con la forma
   `customer-xxxxxxxx.cloudflarestream.com`.
2. **My Profile > API Tokens > Create Token**, con el permiso `Stream: Edit`.
3. En el `.env`:

```
VIDEO_PROVEEDOR=stream
STREAM_ACCOUNT_ID=...
STREAM_API_TOKEN=...
STREAM_DOMINIO=customer-xxxxxxxx.cloudflarestream.com
```

Los videos se crean con firma obligatoria, asi que el enlace del reproductor
tambien caduca.

## Si falta algo

Si se pide `r2` o `stream` sin las claves completas, el servidor avisa en el
arranque y se queda en `youtube` en lugar de romper las subidas. Lo mismo si la
variable trae un valor que no existe.

## Lo que conviene saber

- **El peso maximo (`VIDEO_MAXIMO_MB`) lo comprueba el navegador.** Quien firma
  la subida es siempre un ADMIN, asi que alcanza; no es una barrera contra un
  atacante.
- **El corte de la muestra gratis es del reproductor, no del archivo.** El
  backend no manda el video de las lecciones bloqueadas, pero de la leccion de
  muestra manda el archivo entero y el reproductor lo corta en
  `previewSeconds`. Para que el recorte sea real, sube como muestra un video ya
  cortado.
- **El avance publico del curso sigue siendo un enlace de YouTube.** Es
  promocion: ahi YouTube es gratis y ayuda a que lo encuentren. Lo que se aloja
  en nuestro almacen es el contenido que se paga.
- Al cambiar o borrar el video de una leccion, el archivo anterior se borra del
  almacen para no seguir pagandolo.
