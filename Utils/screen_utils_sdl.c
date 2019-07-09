#include "screen_utils_sdl.h"
#include "screen_a.h"






SCREEN_Key SCREEN_keyFromSdlKeysym(const SDL_Keysym* keysym)
{
    switch (keysym->sym)
    {

    case SDLK_BACKSPACE:
        return SCREEN_Key_BACKSPACE;
    case SDLK_TAB:
        return SCREEN_Key_TAB;
    case SDLK_KP_ENTER:
        return SCREEN_Key_ENTER;
    case SDLK_LSHIFT:
    case SDLK_RSHIFT:
        return SCREEN_Key_SHIFT;
    case SDLK_LCTRL:
    case SDLK_RCTRL:
        return SCREEN_Key_CTRL;
    case SDLK_LALT:
    case SDLK_RALT:
        return SCREEN_Key_ALT;
    case SDLK_PAUSE:
        return SCREEN_Key_PAUSE;
    case SDLK_CAPSLOCK:
        return SCREEN_Key_CAPS_LOCK;
    case SDLK_ESCAPE:
        return SCREEN_Key_ESCAPE;
    case SDLK_SPACE:
        return SCREEN_Key_SPACE;
    case SDLK_PAGEUP:
        return SCREEN_Key_PAGE_UP;
    case SDLK_PAGEDOWN:
        return SCREEN_Key_PAGE_DOWN;
    case SDLK_END:
        return SCREEN_Key_END;
    case SDLK_HOME:
        return SCREEN_Key_HOME;


    case SDLK_LEFT:
        return SCREEN_Key_LEFT;
    case SDLK_UP:
        return SCREEN_Key_UP;
    case SDLK_RIGHT:
        return SCREEN_Key_RIGHT;
    case SDLK_DOWN:
        return SCREEN_Key_DOWN;


    case SDLK_INSERT:
        return SCREEN_Key_INSERT;
    case SDLK_DELETE:
        return SCREEN_Key_DELETE;


    case SDLK_0:
        return SCREEN_Key_0;
    case SDLK_1:
        return SCREEN_Key_1;
    case SDLK_2:
        return SCREEN_Key_2;
    case SDLK_3:
        return SCREEN_Key_3;
    case SDLK_4:
        return SCREEN_Key_4;
    case SDLK_5:
        return SCREEN_Key_5;
    case SDLK_6:
        return SCREEN_Key_6;
    case SDLK_7:
        return SCREEN_Key_7;
    case SDLK_8:
        return SCREEN_Key_8;
    case SDLK_9:
        return SCREEN_Key_9;


    case SDLK_a:
        return SCREEN_Key_A;
    case SDLK_b:
        return SCREEN_Key_B;
    case SDLK_c:
        return SCREEN_Key_C;
    case SDLK_d:
        return SCREEN_Key_D;
    case SDLK_e:
        return SCREEN_Key_E;
    case SDLK_f:
        return SCREEN_Key_F;
    case SDLK_g:
        return SCREEN_Key_G;
    case SDLK_h:
        return SCREEN_Key_H;
    case SDLK_i:
        return SCREEN_Key_I;
    case SDLK_j:
        return SCREEN_Key_J;
    case SDLK_k:
        return SCREEN_Key_K;
    case SDLK_l:
        return SCREEN_Key_L;
    case SDLK_m:
        return SCREEN_Key_M;
    case SDLK_n:
        return SCREEN_Key_N;
    case SDLK_o:
        return SCREEN_Key_O;
    case SDLK_p:
        return SCREEN_Key_P;
    case SDLK_q:
        return SCREEN_Key_Q;
    case SDLK_r:
        return SCREEN_Key_R;
    case SDLK_s:
        return SCREEN_Key_S;
    case SDLK_t:
        return SCREEN_Key_T;
    case SDLK_u:
        return SCREEN_Key_U;
    case SDLK_v:
        return SCREEN_Key_V;
    case SDLK_w:
        return SCREEN_Key_W;
    case SDLK_x:
        return SCREEN_Key_X;
    case SDLK_y:
        return SCREEN_Key_Y;
    case SDLK_z:
        return SCREEN_Key_Z;


    case SDLK_LGUI:
        return SCREEN_Key_LEFT_META;
    case SDLK_RGUI:
        return SCREEN_Key_RIGHT_META;
    case SDLK_SELECT:
        return SCREEN_Key_SELECT;


    case SDLK_KP_0:
        return SCREEN_Key_NUMPAD_0;
    case SDLK_KP_1:
        return SCREEN_Key_NUMPAD_1;
    case SDLK_KP_2:
        return SCREEN_Key_NUMPAD_2;
    case SDLK_KP_3:
        return SCREEN_Key_NUMPAD_3;
    case SDLK_KP_4:
        return SCREEN_Key_NUMPAD_4;
    case SDLK_KP_5:
        return SCREEN_Key_NUMPAD_5;
    case SDLK_KP_6:
        return SCREEN_Key_NUMPAD_6;
    case SDLK_KP_7:
        return SCREEN_Key_NUMPAD_7;
    case SDLK_KP_8:
        return SCREEN_Key_NUMPAD_8;
    case SDLK_KP_9:
        return SCREEN_Key_NUMPAD_9;


    case SDLK_KP_MULTIPLY:
        return SCREEN_Key_MULTIPLY;
    case SDLK_KP_PLUS:
        return SCREEN_Key_ADD;
    case SDLK_KP_MINUS:
        return SCREEN_Key_SUBTRACT;
    case SDLK_KP_DECIMAL:
        return SCREEN_Key_DECIMAL;
    case SDLK_KP_DIVIDE:
        return SCREEN_Key_DIVIDE;


    case SDLK_F1:
        return SCREEN_Key_F1;
    case SDLK_F2:
        return SCREEN_Key_F2;
    case SDLK_F3:
        return SCREEN_Key_F3;
    case SDLK_F4:
        return SCREEN_Key_F4;
    case SDLK_F5:
        return SCREEN_Key_F5;
    case SDLK_F6:
        return SCREEN_Key_F6;
    case SDLK_F7:
        return SCREEN_Key_F7;
    case SDLK_F8:
        return SCREEN_Key_F8;
    case SDLK_F9:
        return SCREEN_Key_F9;
    case SDLK_F10:
        return SCREEN_Key_F10;
    case SDLK_F11:
        return SCREEN_Key_F11;
    case SDLK_F12:
        return SCREEN_Key_F12;


    case SDLK_NUMLOCKCLEAR:
        return SCREEN_Key_NUM_LOCK;
    case SDLK_SCROLLLOCK:
        return SCREEN_Key_SCROLL_LOCK;
    case SDLK_SEMICOLON:
        return SCREEN_Key_SEMICOLON;
    case SDLK_EQUALS:
        return SCREEN_Key_EQUALS;
    case SDLK_COMMA:
        return SCREEN_Key_COMMA;
    case SDLK_UNDERSCORE:
        return SCREEN_Key_DASH;
    case SDLK_PERIOD:
        return SCREEN_Key_PERIOD;
    case SDLK_SLASH:
        return SCREEN_Key_FORWARD_SLASH;
    case SDLK_BACKQUOTE:
        return SCREEN_Key_GRAVE_ACCENT;
    case SDLK_LEFTBRACKET:
        return SCREEN_Key_OPEN_BRACKET;
    case SDLK_BACKSLASH:
        return SCREEN_Key_BACK_SLASH;
    case SDLK_RIGHTBRACKET:
        return SCREEN_Key_CLOSE_BRACKET;
    case SDLK_QUOTE:
        return SCREEN_Key_SINGLE_QUOTE;


    default:
        return SCREEN_Key_UNKNOWN;
    }
}
































































































