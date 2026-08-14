package com.bombacha.navegador;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://vk.com/board111248001";
    private static final String EXTENSION_URI = "resource://android/assets/bombacha/";
    private static final String EXTENSION_ID = "{233e9592-8c9a-4629-ba9c-cdb986ce1a32}";

    private static GeckoRuntime runtime;
    private GeckoSession session;
    private GeckoView geckoView;
    private EditText addressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        startBrowser();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(4), dp(4), dp(4), dp(4));
        toolbar.setBackgroundColor(Color.WHITE);

        Button back = makeButton("‹");
        Button forward = makeButton("›");
        Button home = makeButton("⌂");
        Button reload = makeButton("↻");

        addressBar = new EditText(this);
        addressBar.setSingleLine(true);
        addressBar.setText(HOME_URL);
        addressBar.setTextSize(13f);
        addressBar.setSelectAllOnFocus(true);
        addressBar.setPadding(dp(10), 0, dp(10), 0);
        LinearLayout.LayoutParams addressParams = new LinearLayout.LayoutParams(0, dp(44), 1f);
        addressParams.setMargins(dp(3), 0, dp(3), 0);

        toolbar.addView(back);
        toolbar.addView(forward);
        toolbar.addView(home);
        toolbar.addView(addressBar, addressParams);
        toolbar.addView(reload);

        geckoView = new GeckoView(this);
        root.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        root.addView(geckoView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        back.setOnClickListener(v -> {
            if (session != null) session.goBack();
        });
        forward.setOnClickListener(v -> {
            if (session != null) session.goForward();
        });
        home.setOnClickListener(v -> loadUrl(HOME_URL));
        reload.setOnClickListener(v -> {
            if (session != null) session.reload();
        });
        addressBar.setOnEditorActionListener((v, actionId, event) -> {
            String value = addressBar.getText().toString().trim();
            if (!value.isEmpty()) {
                if (!value.startsWith("http://") && !value.startsWith("https://")) {
                    value = "https://" + value;
                }
                loadUrl(value);
            }
            return true;
        });
    }

    private Button makeButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(24f);
        button.setAllCaps(false);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setPadding(dp(7), 0, dp(7), 0);
        button.setLayoutParams(new LinearLayout.LayoutParams(dp(44), dp(44)));
        return button;
    }

    private void startBrowser() {
        if (runtime == null) {
            GeckoRuntimeSettings settings = new GeckoRuntimeSettings.Builder()
                    .remoteDebuggingEnabled(true)
                    .build();
            runtime = GeckoRuntime.create(getApplicationContext(), settings);
        }

        session = new GeckoSession();
        session.open(runtime);
        geckoView.setSession(session);

        // Built-in WebExtensions live inside the APK and do not need AMO/XPI signing.
        runtime.getWebExtensionController()
                .ensureBuiltIn(EXTENSION_URI, EXTENSION_ID)
                .accept(
                        extension -> loadUrl(HOME_URL),
                        error -> {
                            Toast.makeText(this, "Bombacha não carregou; abrindo o fórum mesmo assim.", Toast.LENGTH_LONG).show();
                            loadUrl(HOME_URL);
                        }
                );
    }

    private void loadUrl(String url) {
        if (session == null) return;
        addressBar.setText(url);
        session.loadUri(url);
    }

    @Override
    public void onBackPressed() {
        if (session != null) {
            session.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
