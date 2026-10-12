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

## Login com passkey (digital, rosto ou PIN do dispositivo)

O login com passkey usa WebAuthn e precisa de uma validação no servidor. Para habilitá-lo:

1. Aplique a migração `supabase/migrations/20261012000000_passkeys.sql` ao projeto Supabase.
2. Em **Edge Functions → Secrets**, cadastre somente o secret personalizado `WEBAUTHN_ORIGINS`, com as origens completas permitidas separadas por vírgula e sem `/` no final (por exemplo, `https://seu-dominio.example,http://localhost:47631`). As variáveis `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo Supabase às Edge Functions; não tente cadastrá-las como secrets personalizados, pois o prefixo `SUPABASE_` é reservado. Nunca coloque a chave `SERVICE_ROLE` no app.
3. Publique a função `passkeys` com `supabase functions deploy passkeys --no-verify-jwt`. A função valida a sessão do usuário nas operações protegidas e precisa aceitar a primeira chamada de login sem sessão.
4. Depois de entrar com e-mail e senha, use **Cadastrar digital**. O botão muda para **Remover digital**; removê-la exige confirmação e desativa todas as passkeys da conta neste aplicativo, mas não apaga a biometria/PIN do dispositivo. Nas próximas entradas, escolha **Entrar com digital / passkey**.

A passkey é específica para a origem em que foi cadastrada. O app desktop usa `http://localhost:47631`; a versão web precisa usar HTTPS. O navegador/dispositivo decide se confirma com digital, reconhecimento facial, chave de segurança ou PIN. A senha continua disponível como alternativa.

Se o serviço não estiver publicado, o app informará que a função `passkeys` não foi encontrada. Uma origem ausente de `WEBAUTHN_ORIGINS` também será indicada como configuração, não como falta de internet.
