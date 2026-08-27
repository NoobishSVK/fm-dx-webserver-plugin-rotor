const rotor = (() => {
    let ws;
    let rotorAzimuth = 0;
    let rotorTargetAzimuth = null;

    /* =========================
       WINDOW
    ========================= */

    const win = $('<div>', {
        id: 'rotor-window',
        class: 'popup-window ui-draggable',
        css: {
            display: 'none',
            width: '360px',
            height: '360px',
            position: 'absolute',
            top: '0',
            left: '50%',
            marginLeft: '-180px',
            zIndex: 9999,
            background: 'var(--color-1-transparent)'
        }
    });

    const header = $('<div>', {
        class: 'popup-header hover-brighten flex-center',
        html: `
        <p style="margin:0;padding-left:10px;" class="color-4">Rotor Control</p>
        <button class="popup-close">✖</button>
    `
    });

    const content = $('<div>', {
        css: {
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
        }
    });

    /* =========================
       COMPASS
    ========================= */

    const compass = $('<div>', {
        id: 'compass',
        css: {
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            outline: '3px solid var(--color-4)',
            position: 'relative',
            background: 'var(--color-main)',
            cursor: 'pointer',
            overflow: 'hidden',
            userSelect: 'none'
        }
    });

    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "280");
    svg.setAttribute("height", "280");
    svg.setAttribute("viewBox", "0 0 280 280");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";

    const cx = 140;
    const cy = 140;
    const radius = 130;

    /* =========================
       SCALE (5°, 10°, 30°)
    ========================= */

    for (let deg = 0; deg < 360; deg += 5) {

        let tickLen = 6;
        let strokeW = 1;

        if (deg % 10 === 0) tickLen = 10;
        if (deg % 30 === 0) {
            tickLen = 16;
            strokeW = 2;
        }
        if (deg % 90 === 0) {
            strokeW = 3;
        }

        const rad = (deg - 90) * Math.PI / 180;

        const x1 = cx + Math.cos(rad) * (radius - tickLen);
        const y1 = cy + Math.sin(rad) * (radius - tickLen);

        const x2 = cx + Math.cos(rad) * radius;
        const y2 = cy + Math.sin(rad) * radius;

        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", "#ddd");
        line.setAttribute("stroke-width", strokeW);

        svg.appendChild(line);

        /* labels every 30° */
        if (deg % 30 === 0) {

            const r = radius - 28;

            const tx = cx + Math.cos(rad) * r;
            const ty = cy + Math.sin(rad) * r;

            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", tx);
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("y", ty);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "11");

            // 👇 color logic
            if (deg % 90 === 0) {
                text.setAttribute("fill", "white");
                text.setAttribute("font-weight", "bold");
            } else {
                text.setAttribute("fill", "var(--color-4)");
                text.setAttribute("font-weight", "normal");
            }

            text.textContent = `${deg}°`;

            svg.appendChild(text);
        }
    }

    /* =========================
       NEEDLE (SVG)
    ========================= */

    /* target / requested position needle */
    const targetNeedle = document.createElementNS(svgNS, "line");

    targetNeedle.setAttribute("x1", cx);
    targetNeedle.setAttribute("y1", cy);
    targetNeedle.setAttribute("x2", cx);
    targetNeedle.setAttribute("y2", cy - 125);
    targetNeedle.setAttribute("stroke", "var(--color-5-transparent)");
    targetNeedle.setAttribute("stroke-width", "3");
    targetNeedle.setAttribute("stroke-linecap", "round");
    targetNeedle.setAttribute("stroke-dasharray", "8 5");
    targetNeedle.setAttribute("opacity", "0.45");
    targetNeedle.style.display = "none";

    const targetTip = document.createElementNS(svgNS, "circle");

    targetTip.setAttribute("cx", cx);
    targetTip.setAttribute("cy", cy - 125);
    targetTip.setAttribute("r", 4);
    targetTip.setAttribute("fill", "var(--color-text)");
    targetTip.setAttribute("opacity", "0.45");
    targetTip.style.display = "none";


    const needle = document.createElementNS(svgNS, "line");
    needle.setAttribute("x1", cx);
    needle.setAttribute("y1", cy);
    needle.setAttribute("x2", cx);
    needle.setAttribute("y2", cy - 125);
    needle.setAttribute("stroke", "var(--color-5-transparent)");
    needle.setAttribute("stroke-width", "3");
    needle.setAttribute("stroke-linecap", "round");

    /* red tip */
    const tip = document.createElementNS(svgNS, "circle");
    tip.setAttribute("cx", cx);
    tip.setAttribute("cy", cy - 125);
    tip.setAttribute("r", 4);
    tip.setAttribute("fill", "var(--color-text)");

    svg.appendChild(targetNeedle);
    svg.appendChild(targetTip);

    svg.appendChild(needle);
    svg.appendChild(tip);

    /* center dot */
    const center = document.createElement("div");
    center.style.width = "12px";
    center.style.height = "12px";
    center.style.borderRadius = "50%";
    center.style.background = "white";
    center.style.position = "absolute";
    center.style.top = "50%";
    center.style.left = "50%";
    center.style.transform = "translate(-50%, -50%)";

    compass.append(svg);
    compass.append(center);

    /* =========================
       LABEL
    ========================= */

    const label = $('<div>', {
        id: 'azimuth-label',
        html: `<div class="bg-color-1 color-5 text-light rotor-azimuth" style="padding: 2px 20px;min-width: 50px; border-radius: 10px; opacity: 0.7;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size:24px"></i>
            </div>`,
        css: {
            fontSize: '26px',
            fontWeight: 'bold',
            position: 'absolute',
            zIndex: '100',
            top: '220px',
            borderRadius: '10px'
        }
    });

    /* =========================
       BUILD WINDOW
    ========================= */

    content.append(label);
    content.append(compass);

    win.append(header);
    win.append(content);
    $('body').append(win);

    win.draggable({ handle: ".ui-draggable-handle" });
    win.find('.popup-close').on('click', () => win.fadeOut(150));

    /* =========================
       PLUGIN BUTTON
    ========================= */


    let initRotorDOM = setInterval(() => {
        if (typeof addIconToPluginPanel !== 'function') return;

        clearInterval(initRotorDOM);

        addIconToPluginPanel(
            "rotor-control-button-plugins",
            "Rotor",
            "regular",
            "compass",
            "Rotor Control"
        );

        $("#rotor-control-button-plugins").addClass("hide-desktop");
        $("#rotor-control-button-plugins").find("span").append(' (<span class="rotor-azimuth"></span>)');

        let $serverInfoContainer = $('.dashboard-panel-plugin-content');

        let rotorPanel = $(`
        <div id="rotor-control-button" class="flex-container flex-center tooltip hide-phone hover-brighten br-15 p-10" style="height: 48px;padding-right: 10px;" data-tooltip="aaaaa" data-tooltip-placement="bottom">
            <i class="fa-regular fa-compass fa-lg color-4"></i>
            <span class="color-4 rotor-azimuth" style="font-size: 32px;padding-bottom:2px;font-weight: 100;margin-left: 10px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:24px"></i>
</span><br>
        </div>
    `);


        rotorPanel.insertBefore($serverInfoContainer);

        connectRotorWS();
        $('[id^="rotor-control-button"]').on('click', function () {
            win.fadeIn(150);
        });

    }, 100);

    /* =========================
       WEBSOCKET
    ========================= */

    function connectRotorWS() {

        if (ws && ws.readyState === 1) return;

        ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/data_plugins`);

        ws.onmessage = (event) => {

            const msg = JSON.parse(event.data);

            if (msg.type === 'rotor:init' || msg.type === 'rotor:update') {

                const state = msg.value || msg;

                if (state.azimuth !== undefined) {
                    setAzimuth(state.azimuth);
                }

                setTargetAzimuth(state.targetAzimuth);
            }
        };
    }

    /* =========================
       UPDATE ROTATION
    ========================= */

    function setAzimuth(val) {

        rotorAzimuth = normalizeAzimuth(val);

        $(".rotor-azimuth").text(Math.round(rotorAzimuth) + '°');

        // Actual rotor position
        needle.setAttribute(
            "transform",
            `rotate(${rotorAzimuth} ${cx} ${cy})`
        );

        tip.setAttribute(
            "transform",
            `rotate(${rotorAzimuth} ${cx} ${cy})`
        );

        // If we have a target, update the target needle too
        if (rotorTargetAzimuth !== null) {

            targetNeedle.setAttribute(
                "transform",
                `rotate(${rotorTargetAzimuth} ${cx} ${cy})`
            );

            targetTip.setAttribute(
                "transform",
                `rotate(${rotorTargetAzimuth} ${cx} ${cy})`
            );

            targetNeedle.style.display = "";
            targetTip.style.display = "";
        }
    }

    function setTargetAzimuth(val) {

        if (val === null || val === undefined) {
            rotorTargetAzimuth = null;

            targetNeedle.style.display = "none";
            targetTip.style.display = "none";

            return;
        }

        rotorTargetAzimuth = normalizeAzimuth(val);

        if (angularDifference(rotorAzimuth, rotorTargetAzimuth) <= 3) {  // Already close enough?
            rotorTargetAzimuth = null; 

            targetNeedle.style.display = "none";
            targetTip.style.display = "none";

            return;
        }

        targetNeedle.setAttribute(
            "transform",
            `rotate(${rotorTargetAzimuth} ${cx} ${cy})`
        );

        targetTip.setAttribute(
            "transform",
            `rotate(${rotorTargetAzimuth} ${cx} ${cy})`
        );

        targetNeedle.style.display = "";
        targetTip.style.display = "";
    }

    /* =========================
       CLICK → ANGLE
    ========================= */

    compass.on('click', function (e) {

        const offset = $(this).offset();
        const cxScreen = offset.left + $(this).width() / 2;
        const cyScreen = offset.top + $(this).height() / 2;

        const dx = e.pageX - cxScreen;
        const dy = e.pageY - cyScreen;

        let angle = Math.atan2(dx, -dy) * (180 / Math.PI);

        if (angle < 0) angle += 360;

        sendAzimuth(angle);
    });

    /* =========================
       SEND
    ========================= */

    function sendAzimuth(angle) {

        ws.send(JSON.stringify({
            type: 'rotor:set',
            azimuth: Math.round(angle)
        }));
    }

    function normalizeAzimuth(value) {
        return ((value % 360) + 360) % 360;
    }

    function angularDifference(a, b) {
        return Math.abs(((a - b + 540) % 360) - 180);
    }


})();
