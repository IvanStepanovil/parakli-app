/* Общий скрипт для всех страниц мини-приложения: связь с сервером. */
(function () {
  // Адрес сервера с API (туннель до вашего компьютера, например ngrok).
  // Поменяйте на свой домен, например 'https://my-name.ngrok-free.app'.
  // Если страницы раздаёт тот же сервер, что и API, оставьте ''.
  var API_BASE = 'https://parakli-ivanstepanovil.waw0.amvera.tech';

  var tg = window.Telegram && window.Telegram.WebApp;

  // Системная кнопка в левом верхнем углу Telegram всегда остаётся «Закрыть».
  // Telegram помнит состояние BackButton между страницами, поэтому скрываем её на каждой загрузке
  // (и при возврате из кэша браузера). Возврат между экранами делается стрелкой «←» внутри страниц.
  function hideTgBack() { try { if (tg && tg.BackButton) tg.BackButton.hide(); } catch (e) {} }
  hideTgBack();
  window.addEventListener('pageshow', hideTgBack);

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
// Отправка файла (multipart). Заголовок Content-Type браузер выставит сам
  function upload(path, formData) {
    formData.append('init_data', (tg && tg.initData) || '');
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': '1' },
      body: formData
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok && d && d.user) Parakli.cacheUser(d.user);
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }
  var Parakli = {
    getSession: function () {
      return call('/api/session').then(function (r) { if (r.ok && r.data && r.data.user) Parakli.cacheUser(r.data.user); return r; });
    },
    register: function (data) {
      return call('/api/register', data).then(function (r) { if (r.ok && r.data && r.data.user) Parakli.cacheUser(r.data.user); return r; });
    },
    // Сохранение страницы «Мои данные»; при успехе обновляем сохранённую копию профиля
    updateProfile: function (data) {
      return call('/api/profile', data).then(function (r) { if (r.ok && r.data && r.data.user) Parakli.cacheUser(r.data.user); return r; });
    },
// Загрузка своей аватарки (фото уже уменьшено на телефоне)
    uploadAvatar: function (blob) {
      var fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');
      return upload('/api/avatar', fd);
    },
    // Удаление загруженного фото: пользователю возвращается его готовая аватарка
    deleteAvatar: function () {
      return call('/api/avatar/delete').then(function (r) { if (r.ok && r.data && r.data.user) Parakli.cacheUser(r.data.user); return r; });
    },
    // Показать загруженное фото в <img>. Грузим через fetch (так работает и туннель ngrok), браузер кэширует файл
    showAvatarFile: function (img, file, onFail) {
      var req = img._req = (img._req || 0) + 1;
      fetch(API_BASE + '/avatars/' + encodeURIComponent(file), { headers: { 'ngrok-skip-browser-warning': '1' } })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); })
        .then(function (b) {
          if (img._req !== req) return;                 // за это время выбрали другую картинку
          if (img._objUrl) URL.revokeObjectURL(img._objUrl);
          img._objUrl = URL.createObjectURL(b);
          img.src = img._objUrl;
        })
        .catch(function () { if (img._req === req && onFail) onFail(); });
    },
    // Показать обычную картинку (готовая аватарка или предпросмотр выбранного фото)
    showAvatarPreset: function (img, src) {
      img._req = (img._req || 0) + 1;                   // отменяет незавершённую загрузку фото с сервера
      img.src = src;
    },
    // Копия профиля на устройстве: страницы показывают имя и аватарку сразу, а свежие данные подтягиваются в фоне
    cacheUser: function (user) { try { localStorage.setItem('parakli_user_v1', JSON.stringify(user)); } catch (e) {} },
    cachedUser: function () {
      try {
        var u = JSON.parse(localStorage.getItem('parakli_user_v1') || 'null');
        var me = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id;
        return (u && typeof u === 'object' && (!me || u.telegram_id === me)) ? u : null;
      } catch (e) { return null; }
    },

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

  /* Фоновая подгрузка картинок следующих экранов, пока пользователь читает текущий.
     Когда он перейдёт дальше, картинки уже лежат в кэше и появляются сразу.
     Ничего не делает при экономии трафика или медленной сети.
     Чтобы поменять набор, правьте списки ниже (ключ — имя текущей страницы). */
  var PREFETCH = {
    'index.html':    ['Фото/Фон главного экрана.png', 'Фото/Лого.png'],
    'main.html':     ['Фото/Фон блока тренировок.png', 'Фото/Фон помощи.png',
                      'Фото/Мяч 4см.png', 'Фото/Мяч 6см.png', 'Фото/Арахис.png'],
    'profile.html':  ['Фото/Статья №1.png', 'Фото/Статья №2.png', 'Фото/Статья №3.png',
                      'Фото/Статья №4.png', 'Фото/Статья №5.png', 'Фото/Фон помощи.png']
  };
  function prefetchNext() {
    try {
      var c = navigator.connection;
      if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;
      var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      (PREFETCH[page] || []).forEach(function (src) { var i = new Image(); i.decoding = 'async'; i.src = src; });
    } catch (e) {}
  }
  window.addEventListener('load', function () {
    if (window.requestIdleCallback) requestIdleCallback(prefetchNext, { timeout: 4000 });
    else setTimeout(prefetchNext, 1500);
  });
})();
