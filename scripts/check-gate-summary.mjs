const loginResponse = await fetch('http://localhost:3001/api/auth', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'gate@msec.edu.in', password: '123' })
})
const login = await loginResponse.json()
console.log('login', loginResponse.status, login.success, login.error || '')
if (login.token) {
  const summaryResponse = await fetch('http://localhost:3001/api/gate?action=summary', {
    headers: { authorization: `Bearer ${login.token}` }
  })
  console.log('summary', summaryResponse.status, await summaryResponse.text())
}
