addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const apiUrl = 'https://api.tiger-sms.com/stubs/handler_api.php' + url.search
  
  const modifiedRequest = new Request(apiUrl, {
    method: request.method,
    headers: request.headers
  })
  
  const response = await fetch(modifiedRequest)
  
  const modifiedResponse = new Response(response.body, response)
  
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*')
  
  return modifiedResponse
} 