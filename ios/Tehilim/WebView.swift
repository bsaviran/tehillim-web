import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// Shows the bundled site (index.html, app.js, style.css, tehillim.json, images) and bridges a few actions to native iOS.
struct WebView: UIViewRepresentable {
    var onReminderTap: () -> Void
    var onThemeChange: (Bool) -> Void

    /// The site is served from the app bundle under this address. A custom scheme (rather than file://)
    /// lets the page fetch() tehillim.json and keeps localStorage on a stable origin.
    static let startURL = URL(string: "\(BundleSchemeHandler.scheme)://app/index.html")!

    /// Shared in place of the page address, which inside the app isn't a web link.
    static let siteURL = "https://bsaviran.github.io/tehillim-web/"

    /// Runs after the page loads: adds a reminder button to the header, swaps the WhatsApp share
    /// for the native share sheet, and reports the light/dark theme to the app.
    private static let bridgeScript = """
    (function () {
      function post(msg) { window.webkit.messageHandlers.native.postMessage(msg); }

      var actions = document.querySelector('.header-actions');
      if (actions) {
        var b = document.createElement('button');
        b.className = 'btn-theme';
        b.textContent = '🔔';
        b.title = 'תזכורת יומית';
        b.setAttribute('aria-label', 'תזכורת יומית');
        b.onclick = function () { post({ action: 'reminder' }); };
        actions.insertBefore(b, actions.firstChild);
      }

      var shareBtn = document.querySelector('.btn-whatsapp');
      if (shareBtn) {
        shareBtn.title = 'שיתוף';
        shareBtn.setAttribute('aria-label', 'שיתוף');
        shareBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
      }
      window.shareToWhatsapp = function () {
        var what = 'ספר תהילים';
        var link = '\(siteURL)';
        try {
          if (currentChapter > 0) {
            what = 'פרק ' + toGematria(currentChapter);
            link += '?perek=' + currentChapter;
          }
        } catch (e) {}
        post({ action: 'share', text: 'מזמין אותך לקרוא תהילים איתי: ' + what + '\\n' + link });
      };

      var originalApplyTheme = window.applyTheme;
      window.applyTheme = function (theme) {
        originalApplyTheme(theme);
        post({ action: 'theme', light: theme === 'light' });
      };
      post({ action: 'theme', light: document.documentElement.dataset.theme === 'light' });
    })();
    """

    /// The page links Google Fonts; in the app the same families come from the bundle instead,
    /// so the text looks the same offline and nothing is requested from Google.
    private static let localFontsScript = """
    (function () {
      var css = "@font-face { font-family: 'Heebo'; src: url('Heebo.ttf') format('truetype'); font-weight: 100 900; }" +
                "@font-face { font-family: 'Noto Serif Hebrew'; src: url('NotoSerifHebrew.ttf') format('truetype'); font-weight: 100 900; }";
      var style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    })();
    """

    private static let blockRemoteFontsRules = """
    [
      { "trigger": { "url-filter": "^https?://fonts\\\\.googleapis\\\\.com" }, "action": { "type": "block" } },
      { "trigger": { "url-filter": "^https?://fonts\\\\.gstatic\\\\.com" }, "action": { "type": "block" } }
    ]
    """

    func makeCoordinator() -> Coordinator {
        Coordinator(onReminderTap: onReminderTap, onThemeChange: onThemeChange)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.addUserScript(WKUserScript(source: Self.localFontsScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        contentController.addUserScript(WKUserScript(source: Self.bridgeScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        contentController.add(WeakScriptMessageHandler(context.coordinator), name: "native")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.dataDetectorTypes = []
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        #if DEBUG
        webView.isInspectable = true
        #endif

        // Load only once the blocking rules are in place, so the first load doesn't reach Google.
        // The compiled rules are kept on disk, so only the first launch has to compile them.
        let store = WKContentRuleListStore.default()!
        let ruleID = "block-remote-fonts-v1"
        let start = { (rules: WKContentRuleList?) in
            if let rules {
                contentController.add(rules)
            }
            webView.load(URLRequest(url: Self.startURL))
        }
        store.lookUpContentRuleList(forIdentifier: ruleID) { cached, _ in
            if let cached {
                start(cached)
            } else {
                store.compileContentRuleList(forIdentifier: ruleID, encodedContentRuleList: Self.blockRemoteFontsRules) { rules, _ in
                    start(rules)
                }
            }
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onReminderTap = onReminderTap
        context.coordinator.onThemeChange = onThemeChange
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "native")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var onReminderTap: () -> Void
        var onThemeChange: (Bool) -> Void
        weak var webView: WKWebView?
        private var loadedOn = Date()

        init(onReminderTap: @escaping () -> Void, onThemeChange: @escaping (Bool) -> Void) {
            self.onReminderTap = onReminderTap
            self.onThemeChange = onThemeChange
            super.init()
            NotificationCenter.default.addObserver(self, selector: #selector(reloadIfNewDay), name: UIApplication.willEnterForegroundNotification, object: nil)
        }

        /// The page works out today's weekly/monthly reading once, on load;
        /// reload it if the app was left open overnight.
        @objc private func reloadIfNewDay() {
            guard let webView, !Calendar.current.isDateInToday(loadedOn) else { return }
            ReminderTapHandler.shared.openToday = nil  // a reminder tap waits for the reloaded page
            webView.reload()
        }

        // Keep the app on the bundled site; open any web link in Safari / the relevant app.
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            if url.scheme == BundleSchemeHandler.scheme || url.scheme == "about" { return .allow }
            await UIApplication.shared.open(url)
            return .cancel
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            loadedOn = Date()
            ReminderTapHandler.shared.openToday = { [weak webView] in
                webView?.evaluateJavaScript("switchTab('daily'); selectDay(todayIndex);")
            }
        }

        // window.open(...) → open externally.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
            switch action {
            case "reminder":
                onReminderTap()
            case "share":
                share(text: body["text"] as? String ?? "תהילים", from: message.webView)
            case "theme":
                onThemeChange(body["light"] as? Bool ?? false)
            default:
                break
            }
        }

        private func share(text: String, from webView: WKWebView?) {
            guard let presenter = webView?.window?.rootViewController?.topmostPresented else { return }
            let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = webView
            presenter.present(sheet, animated: true)
        }
    }
}

/// Serves files from the app bundle for `app://app/<path>` requests.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "app"

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let root = Bundle.main.resourceURL?.standardizedFileURL else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        // Only files inside the bundle; ignores query strings such as style.css?v=7.
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(Data())
            urlSchemeTask.didFinish()
            return
        }

        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": mime,
            "Content-Length": String(data.count),
        ])!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

/// WKUserContentController retains its handlers strongly; this avoids a retain cycle.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

private extension UIViewController {
    var topmostPresented: UIViewController {
        presentedViewController?.topmostPresented ?? self
    }
}
