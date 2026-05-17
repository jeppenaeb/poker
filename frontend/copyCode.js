(function () {
  async function copyGameCode(code, button) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement("input");
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }

      button.textContent = "Kopieret";
      setTimeout(() => {
        button.textContent = "Kopiér";
      }, 1200);
    } catch (_error) {
      button.textContent = "Kunne ikke kopiere";
      setTimeout(() => {
        button.textContent = "Kopiér";
      }, 1600);
    }
  }

  function renderCopyCodeButton(game) {
    document.querySelectorAll(".copy-code-button").forEach((button) => button.remove());

    const currentPlayerId = window.pokerCurrentPlayerId || "";
    const currentPlayer = game.players.find((player) => player.id === currentPlayerId);
    const isHost = Boolean(currentPlayer?.isHost);

    if (!isHost || game.status !== "lobby") return;

    const codePill = document.getElementById("lobbyCode");
    if (!codePill) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code-button";
    button.dataset.copyCode = game.code;
    button.textContent = "Kopiér";
    codePill.insertAdjacentElement("afterend", button);
  }

  if (typeof renderLobby === "function") {
    const originalRenderLobby = renderLobby;
    renderLobby = (game) => {
      originalRenderLobby(game);
      renderCopyCodeButton(game);
    };
    window.renderLobby = renderLobby;
  }

  document.addEventListener("click", (event) => {
    const copyButton = event.target.closest(".copy-code-button");
    if (!copyButton) return;
    copyGameCode(copyButton.dataset.copyCode || "", copyButton);
  });
})();
