# Controle de Gastos

Aplicativo web instalável (PWA) e versão portátil para Windows. Cada pessoa deve usar a própria conta; os registros não devem ser compartilhados entre contas.

## Gerar o executável para Windows

Requer Node.js e npm instalados. No PowerShell, dentro desta pasta, execute:

```powershell
npm.cmd install
npm.cmd run dist
```

O executável portátil será criado na raiz desta pasta como `Controle de Gastos.exe` e também em `dist\Controle de Gastos.exe`. Ele não precisa de instalação, mas o Windows pode exibir um aviso do SmartScreen porque o executável não está assinado digitalmente.

O ícone `icon.ico` contém versões em vários tamanhos, geradas com suavização a partir de `icon-512.png` para manter a nitidez em diferentes tamanhos de exibição. O empacotamento arquiva os arquivos do app e ofusca os scripts JavaScript no executável. A versão original e legível continua em `index.html`.

O arquivo `vercel.json` publica a pasta `app-build` produzida pelo comando de build, tanto para o Vercel quanto para a versão web.

## Privacidade e proteção de dados

O acesso aos dados é controlado pela conta autenticada e pelas políticas de segurança do serviço. A chave pública de cliente necessária ao app não é uma senha. Nunca inclua chaves administrativas ou secretas do Supabase no HTML, no executável ou em um repositório público.

O app mantém dados e a sessão no armazenamento local do navegador/WebView para permitir o uso offline. Esse armazenamento não é criptografado pelo app: proteja o dispositivo com uma conta do sistema e criptografia de disco, saia da conta em dispositivos compartilhados e evite usar computadores públicos.

O botão **Esqueci minha senha** envia um link para redefinir a senha. Para login, sincronização e modo offline/PWA funcionarem, abra o app por um endereço HTTP/HTTPS; abrir `index.html` diretamente com `file://` não oferece esses recursos de forma confiável.

Use o botão **Backup** regularmente, especialmente antes de trocar de computador.
