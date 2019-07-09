#include "screen_utils_sdl.h"
#include "screen_a.h"






SCREEN_Key SCREEN_keyFromSdlKeysym(const SDL_Keysym* keysym)
{
    switch (keysym->sym)
    {
    case SDLK_SPACE:
        return SCREEN_Key_SPACE;
    case SDLK_LEFT:
        return SCREEN_Key_LEFT;
    case SDLK_UP:
        return SCREEN_Key_UP;
    case SDLK_RIGHT:
        return SCREEN_Key_RIGHT;
    case SDLK_DOWN:
        return SCREEN_Key_DOWN;
    default:
        return SCREEN_Key_UNKNOWN;
    }
}
































































































