/* Общий скрипт для всех страниц мини-приложения: связь с сервером. */
(function () {
  // Адрес сервера с API (туннель до вашего компьютера, например ngrok).
  // Поменяйте на свой домен, например 'https://my-name.ngrok-free.app'.
  // Если страницы раздаёт тот же сервер, что и API, оставьте ''.
  var API_BASE = 'https://ВАШ-ДОМЕН.ngrok-free.app';

  var tg = window.Telegram && window.Telegram.WebApp;

  function call(path, body) {
    var payload = Object.assign({ init_data: (tg && tg.initData) || '' }, body || {});
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  var Parakli = {
    getSession: function () { return call('/api/session'); },
    register: function (data) { return call('/api/register', data); },

    // «Уже проверяли в этом сеансе» — чтобы не обращаться к серверу на каждой странице
    markVerified: function () { try { sessionStorage.setItem('parakli_verified', '1'); } catch (e) {} },
    isVerified: function () { try { return sessionStorage.getItem('parakli_verified') === '1'; } catch (e) { return false; } },

    // Если пользователь не зарегистрирован — отправляем на первый экран
    guard: function () {
      if (Parakli.isVerified()) return;
      Parakli.getSession().then(function (r) {
        if (r.ok && r.data.registered) Parakli.markVerified();
        else location.replace('index.html' + location.search);
      }).catch(function () { /* нет связи — не выкидываем пользователя */ });
    }
  };
  window.Parakli = Parakli;
})();